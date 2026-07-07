// POST /api/shopee/webhook — Shopee Push Notification receiver
// Shopee sends real-time events here when order status changes

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ShopeeWebhookPayload } from '@/lib/shopee/types'
import { getOrderDetail, upsertOrderToDB, getTrackingNumber } from '@/lib/shopee/orderManager'

/**
 * Validates the webhook signature sent by Shopee.
 * Shopee signs the raw body with HMAC-SHA256 using the Partner Key.
 */
function validateWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  const partnerKey = process.env.SHOPEE_PARTNER_KEY ?? ''
  const baseString = `${process.env.SHOPEE_PARTNER_ID}.${rawBody}`
  const expected = crypto
    .createHmac('sha256', partnerKey)
    .update(baseString)
    .digest('hex')
  return expected === signatureHeader
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signatureHeader = req.headers.get('Authorization') ?? ''

  // Validate webhook authenticity
  if (!validateWebhookSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody) as ShopeeWebhookPayload

  // Route by event code
  switch (payload.code) {
    case 3: // ORDER_STATUS_RESERVED — new order placed
    case 4: // ORDER_STATUS_READY_TO_SHIP — payment confirmed
    case 5: // ORDER_STATUS_SHIPPED
    case 6: // ORDER_STATUS_CANCELLED
      await handleOrderEvent(payload)
      break

    default:
      console.log('[Shopee Webhook] Unhandled event code:', payload.code)
  }

  // Shopee expects a 200 response within 5 seconds
  return NextResponse.json({ success: true })
}

async function handleOrderEvent(payload: ShopeeWebhookPayload) {
  const orderSn = payload.data?.ordersn
  if (!orderSn) return

  // Fetch full order details from Shopee
  const order = await getOrderDetail(orderSn)

  // Persist to DB
  await upsertOrderToDB(order)

  // If ready to ship, grab tracking number automatically
  if (order.order_status === 'READY_TO_SHIP') {
    try {
      await getTrackingNumber(orderSn)
    } catch (err) {
      console.error('[Shopee] Failed to get tracking for', orderSn, err)
    }

    // Notifica Anderson no WhatsApp via N8N
    const shopeeNotifUrl = process.env.N8N_SHOPEE_PEDIDO_URL
    if (shopeeNotifUrl) {
      try {
        await fetch(shopeeNotifUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_sn: orderSn,
            buyer: order.buyer_username,
            total: order.total_amount,
          }),
        })
      } catch {
        // Notificacao falhou mas pedido ja foi salvo — segue em frente
      }
    }
  }

  console.log(`[Shopee Webhook] Order ${orderSn} → ${order.order_status}`)
}
