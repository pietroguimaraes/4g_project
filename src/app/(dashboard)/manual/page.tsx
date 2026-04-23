export default function ManualPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Manual de Uso</h1>
      <p className="text-gray-500 text-sm mb-8">Guia completo do 4G Dashboard</p>

      <div className="flex flex-col gap-6">

        {/* Visão geral */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">📋 O que é o 4G Dashboard?</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            O 4G Dashboard é o painel de controle da prospecção via WhatsApp. Ele recebe os clientes
            encontrados pelo sistema, permite que você revise e aprove cada um, e acompanha o andamento
            das conversas em tempo real — tudo em um só lugar.
          </p>
        </section>

        {/* Painel de Aprovação */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">✅ Painel de Aprovação</h2>
          <p className="text-sm text-gray-600 mb-3">
            Aqui aparecem as empresas que o sistema encontrou e que estão aguardando sua revisão.
          </p>
          <ul className="text-sm text-gray-600 flex flex-col gap-2">
            <li className="flex gap-2">
              <span className="text-green-600 font-bold shrink-0">→ Aprovar:</span>
              <span>Arraste o card para a direita. A empresa vai direto para <strong>Prospectados</strong> e o WhatsApp é enviado automaticamente.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600 font-bold shrink-0">→ Descartar:</span>
              <span>Arraste o card para a esquerda. A empresa vai para <strong>Descartados</strong> e não recebe mensagem.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600 font-bold shrink-0">→ Aprovar Todos:</span>
              <span>Clique no botão verde no canto superior direito para aprovar todas as empresas de uma vez.</span>
            </li>
          </ul>
          <div className="mt-4 bg-blue-50 rounded p-3 text-xs text-blue-700">
            💡 <strong>Atenção:</strong> Só aprove empresas que você considera com bom perfil para compra. O WhatsApp é disparado imediatamente após a aprovação.
          </div>
        </section>

        {/* Busca de empresas */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">🔍 Como buscar novas empresas</h2>
          <ol className="text-sm text-gray-600 flex flex-col gap-2 list-decimal list-inside">
            <li>No Painel de Aprovação, preencha o formulário <strong>Nova Busca de Empresas</strong></li>
            <li>Selecione o Estado, a Cidade e o Tipo de Loja que quer prospectar</li>
            <li>Escolha a quantidade de empresas (até 100)</li>
            <li>Clique em <strong>Iniciar Busca</strong></li>
            <li>Aguarde alguns minutos — as empresas aparecerão automaticamente no painel</li>
          </ol>
        </section>

        {/* Adicionar manualmente */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">➕ Adicionar empresa manualmente</h2>
          <p className="text-sm text-gray-600 mb-3">
            Use quando quiser adicionar uma empresa específica que você já conhece, sem passar pela busca automática.
          </p>
          <ol className="text-sm text-gray-600 flex flex-col gap-2 list-decimal list-inside">
            <li>Clique no botão <strong>+ Adicionar Empresa</strong> (canto superior direito)</li>
            <li>Digite o nome da empresa e o telefone com DDD (ex: 11999998888)</li>
            <li>Clique em <strong>Salvar</strong></li>
            <li>A empresa vai direto para <strong>Prospectados</strong> e o WhatsApp é disparado imediatamente</li>
          </ol>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">Manual</span>
            <span className="text-xs text-gray-500">Empresas adicionadas manualmente ficam com este badge roxo no Kanban.</span>
          </div>
        </section>

        {/* Kanban */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">📊 Kanban — Acompanhamento do Funil</h2>
          <p className="text-sm text-gray-600 mb-4">
            O Kanban mostra em qual etapa cada lead está. Arraste os cards entre as colunas para mover um lead de etapa.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 items-start">
              <div className="w-3 h-3 rounded-full bg-blue-400 shrink-0 mt-0.5"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Prospectados</p>
                <p className="text-xs text-gray-500">Lead aprovado e WhatsApp enviado. Aguardando resposta.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-3 h-3 rounded-full bg-yellow-400 shrink-0 mt-0.5"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Não Responderam</p>
                <p className="text-xs text-gray-500">Lead que não respondeu. Arraste de volta para <strong>Prospectados</strong> quando quiser fazer um follow-up — um novo WhatsApp será enviado automaticamente.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-3 h-3 rounded-full bg-orange-400 shrink-0 mt-0.5"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Interesse</p>
                <p className="text-xs text-gray-500">Lead respondeu e demonstrou interesse. O agente já qualificou.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-3 h-3 rounded-full bg-green-400 shrink-0 mt-0.5"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Transferidos</p>
                <p className="text-xs text-gray-500">Lead qualificado e passado para o closer. Use o botão <strong>Transferir</strong> nos cards de Interesse.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-3 h-3 rounded-full bg-gray-400 shrink-0 mt-0.5"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Descartados</p>
                <p className="text-xs text-gray-500">Lead sem perfil ou que não tem interesse. Arquivado para referência.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Ver dados e excluir */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">🗂️ Ver dados e excluir leads</h2>
          <ul className="text-sm text-gray-600 flex flex-col gap-2">
            <li className="flex gap-2">
              <span className="font-medium shrink-0">Ver dados:</span>
              <span>Clique em <strong>Ver dados</strong> em qualquer card do Kanban para ver todas as informações do lead (telefone, cidade, nota, categoria, etc.).</span>
            </li>
            <li className="flex gap-2">
              <span className="font-medium shrink-0">Excluir:</span>
              <span>Dentro da tela de dados, clique em <strong>Excluir lead</strong> (vermelho). O sistema pedirá confirmação antes de deletar.</span>
            </li>
          </ul>
          <div className="mt-3 bg-red-50 rounded p-3 text-xs text-red-700">
            ⚠️ <strong>Atenção:</strong> Excluir um lead remove ele permanentemente do sistema. Esta ação não pode ser desfeita.
          </div>
        </section>

      </div>
    </div>
  )
}
