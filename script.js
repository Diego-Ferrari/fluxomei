// FLUXOMEI - Lógica principal (UUID + CRUD + filtro de calendário)

const SUPABASE_URL = 'https://yvtqfczkxjmzeyjqvxls.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_Pid_-CzlIWhlYp-vZms79g_NWbsOfKf'
const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const MESES_ABREVIADOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
let categorias = []
let contas = []
let lancamentos = []
let recurrences = []
let graficoMovimentacoes = null
let usuarioAtual = null
let periodoSelecionado = obterMesAtualISO()
let sessaoAtual = null



function obterMesAtualISO() {
  return new Date().toISOString().slice(0, 7)
}

function criarDataLocal(dataTexto) {
  if (!dataTexto) return null
  const partes = String(dataTexto).slice(0, 10).split('-').map(Number)
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null
  return new Date(partes[0], partes[1] - 1, partes[2])
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function formatarData(dataTexto) {
  const data = criarDataLocal(dataTexto)
  if (!data || Number.isNaN(data.getTime())) return ''

  const dia = String(data.getDate()).padStart(2, '0')
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const ano = data.getFullYear()
  return `${dia}/${mes}/${ano}`
}

function obterTituloPeriodo(valorPeriodo = periodoSelecionado) {
  if (!valorPeriodo || !/^\d{4}-\d{2}$/.test(valorPeriodo)) return 'Período selecionado'

  const [ano, mes] = valorPeriodo.split('-').map(Number)
  return `${MESES_ABREVIADOS[mes - 1]} ${ano}`
}

function obterCategoriaPorId(id) {
  return categorias.find((categoria) => String(categoria.id) === String(id))
}

function obterContaPorId(id) {
  return contas.find((conta) => String(conta.id) === String(id))
}

function obterLancamentosDoPeriodo() {
  return lancamentos.filter((lancamento) => String(lancamento.data || '').slice(0, 7) === periodoSelecionado)
}

const areaNotificacoes = document.getElementById('notificacoes-area')
const seletorPeriodo = document.getElementById('seletor-periodo')
const botaoExportar = document.getElementById('botao-exportar')

function mostrarNotificacao(mensagem, tipo = 'sucesso') {
  if (!areaNotificacoes) return

  const notificacao = document.createElement('div')
  notificacao.classList.add('notificacao', tipo)

  const icone = document.createElement('i')
  if (tipo === 'sucesso') icone.classList.add('fas', 'fa-check-circle')
  else if (tipo === 'erro') icone.classList.add('fas', 'fa-times-circle')
  else icone.classList.add('fas', 'fa-info-circle')

  const texto = document.createElement('div')
  texto.classList.add('notificacao-mensagem')
  texto.textContent = mensagem

  notificacao.appendChild(icone)
  notificacao.appendChild(texto)
  areaNotificacoes.appendChild(notificacao)

  setTimeout(() => notificacao.remove(), 4000)
}

function criarOpcaoSelect(valor, texto) {
  const opcao = document.createElement('option')
  opcao.value = valor
  opcao.textContent = texto
  return opcao
}

function preencherSeletorPeriodo() {
  if (!seletorPeriodo) return

  const valorPreservado = periodoSelecionado || obterMesAtualISO()
  const anos = new Set([new Date().getFullYear()])

  lancamentos.forEach((lancamento) => {
    const ano = Number(String(lancamento.data || '').slice(0, 4))
    if (Number.isInteger(ano) && ano > 1900) anos.add(ano)
  })

  const anoPeriodoSelecionado = Number(valorPreservado.slice(0, 4))
  if (Number.isInteger(anoPeriodoSelecionado)) anos.add(anoPeriodoSelecionado)

  const anosOrdenados = Array.from(anos).sort((a, b) => b - a)
  seletorPeriodo.innerHTML = ''

  anosOrdenados.forEach((ano) => {
    for (let indiceMes = 11; indiceMes >= 0; indiceMes -= 1) {
      const mes = String(indiceMes + 1).padStart(2, '0')
      const valor = `${ano}-${mes}`
      seletorPeriodo.appendChild(criarOpcaoSelect(valor, `${MESES_ABREVIADOS[indiceMes]} ${ano}`))
    }
  })

  if (!seletorPeriodo.querySelector(`option[value="${valorPreservado}"]`)) {
    const [ano, mes] = valorPreservado.split('-').map(Number)
    seletorPeriodo.appendChild(criarOpcaoSelect(valorPreservado, `${MESES_ABREVIADOS[mes - 1]} ${ano}`))
  }

  seletorPeriodo.value = valorPreservado
  periodoSelecionado = seletorPeriodo.value
}

function atualizarTextosDoPeriodo() {
  const titulo = obterTituloPeriodo()
  const descricaoReceitas = document.getElementById('card-receitas-descricao')
  const descricaoDespesas = document.getElementById('card-despesas-descricao')
  const descricaoSaldo = document.getElementById('card-saldo-descricao')
  const tituloGrafico = document.getElementById('titulo-grafico-movimentacoes')
  const tituloUltimos = document.getElementById('titulo-ultimos-lancamentos')

  if (descricaoReceitas) descricaoReceitas.textContent = `Total recebido em ${titulo}`
  if (descricaoDespesas) descricaoDespesas.textContent = `Saídas registradas em ${titulo}`
  if (descricaoSaldo) descricaoSaldo.textContent = `Resultado líquido de ${titulo}`
  if (tituloGrafico) tituloGrafico.textContent = `Entradas e saídas — ${titulo}`
  if (tituloUltimos) tituloUltimos.textContent = `Lançamentos de ${titulo}`
}

const botoesMenu = document.querySelectorAll('.botao-menu')
const telas = document.querySelectorAll('.tela')
const tituloPagina = document.querySelector('.titulo-pagina')
const subtituloPagina = document.querySelector('.subtitulo-pagina')

const subtitulosPorTela = {
  dashboard: 'Visão geral do caixa e movimentações do mês',
  lancamentos: 'Visualize e filtre todos os lançamentos',
  categorias: 'Organize suas receitas e despesas',
  contas: 'Gerencie suas contas e saldos',
  relatorios: 'Análise detalhada dos seus números',
  configuracoes: 'Dados da sua conta e preferências'
}

const nomesPaginas = {
  dashboard: 'Dashboard',
  lancamentos: 'Lançamentos',
  categorias: 'Categorias',
  contas: 'Contas',
  relatorios: 'Relatórios',
  configuracoes: 'Configurações'
}

function alterarTelaAtiva(telaNome) {
  botoesMenu.forEach((botao) => {
    botao.classList.toggle('ativo', botao.getAttribute('data-tela') === telaNome)
  })

  telas.forEach((tela) => {
    tela.style.display = tela.getAttribute('data-tela') === telaNome ? 'block' : 'none'
  })

  if (tituloPagina) tituloPagina.textContent = nomesPaginas[telaNome] || 'FluxoMEI'
  if (subtituloPagina) subtituloPagina.textContent = subtitulosPorTela[telaNome] || ''
}

botoesMenu.forEach((botao) => {
  botao.addEventListener('click', () => alterarTelaAtiva(botao.getAttribute('data-tela')))
})

const modalLancamento = document.getElementById('modal-lancamento')
const modalCategoria = document.getElementById('modal-categoria')
const modalConta = document.getElementById('modal-conta')
const modalConfirmacao = document.getElementById('modal-confirmacao')

const botaoNovoLancamento = document.getElementById('botao-novo-lancamento')
const botaoNovaCategoria = document.getElementById('botao-nova-categoria')
const botaoNovaConta = document.getElementById('botao-nova-conta')

const botaoFecharModalLancamento = document.getElementById('botao-fechar-modal-lancamento')
const botaoCancelarLancamento = document.getElementById('botao-cancelar-lancamento')
const botaoFecharModalCategoria = document.getElementById('botao-fechar-modal-categoria')
const botaoCancelarCategoria = document.getElementById('botao-cancelar-categoria')
const botaoFecharModalConta = document.getElementById('botao-fechar-modal-conta')
const botaoCancelarConta = document.getElementById('botao-cancelar-conta')
const botaoFecharModalConfirmacao = document.getElementById('botao-fechar-modal-confirmacao')
const botaoCancelarExclusao = document.getElementById('botao-cancelar-exclusao')
const botaoConfirmarExclusao = document.getElementById('botao-confirmar-exclusao')

function abrirModal(modal) {
  if (modal) modal.classList.add('ativo')
}

function fecharModal(modal) {
  if (modal) modal.classList.remove('ativo')
}

if (botaoNovoLancamento) {
  botaoNovoLancamento.addEventListener('click', () => {
    prepararFormularioLancamento()
    abrirModal(modalLancamento)
  })
}

if (botaoNovaCategoria) {
  botaoNovaCategoria.addEventListener('click', () => {
    prepararFormularioCategoria()
    abrirModal(modalCategoria)
  })
}

if (botaoNovaConta) {
  botaoNovaConta.addEventListener('click', () => {
    prepararFormularioConta()
    abrirModal(modalConta)
  })
}

if (botaoFecharModalLancamento) botaoFecharModalLancamento.addEventListener('click', () => fecharModal(modalLancamento))
if (botaoCancelarLancamento) botaoCancelarLancamento.addEventListener('click', () => fecharModal(modalLancamento))
if (botaoFecharModalCategoria) botaoFecharModalCategoria.addEventListener('click', () => fecharModal(modalCategoria))
if (botaoCancelarCategoria) botaoCancelarCategoria.addEventListener('click', () => fecharModal(modalCategoria))
if (botaoFecharModalConta) botaoFecharModalConta.addEventListener('click', () => fecharModal(modalConta))
if (botaoCancelarConta) botaoCancelarConta.addEventListener('click', () => fecharModal(modalConta))
if (botaoFecharModalConfirmacao) botaoFecharModalConfirmacao.addEventListener('click', () => fecharModal(modalConfirmacao))
if (botaoCancelarExclusao) botaoCancelarExclusao.addEventListener('click', () => fecharModal(modalConfirmacao))

let acaoConfirmacao = null

function pedirConfirmacao(mensagem, acao) {
  const mensagemElemento = document.getElementById('mensagem-confirmacao')
  if (mensagemElemento) mensagemElemento.textContent = mensagem
  acaoConfirmacao = acao
  abrirModal(modalConfirmacao)
}

async function executarConfirmacao() {
  if (typeof acaoConfirmacao === 'function') await acaoConfirmacao()
  fecharModal(modalConfirmacao)
  acaoConfirmacao = null
}

if (botaoConfirmarExclusao) botaoConfirmarExclusao.addEventListener('click', executarConfirmacao)

document.addEventListener('keydown', async (evento) => {
  const modalAberto = modalConfirmacao && modalConfirmacao.classList.contains('ativo')
  if (modalAberto && (evento.key === 'Enter' || evento.code === 'NumpadEnter')) {
    evento.preventDefault()
    await executarConfirmacao()
  }
})

window.addEventListener('click', (evento) => {
  if (evento.target === modalLancamento) fecharModal(modalLancamento)
  if (evento.target === modalCategoria) fecharModal(modalCategoria)
  if (evento.target === modalConta) fecharModal(modalConta)
  if (evento.target === modalConfirmacao) fecharModal(modalConfirmacao)
})

const formularioLancamento = document.getElementById('formulario-lancamento')
const campoLancamentoId = document.getElementById('lancamento-id')
const campoLancamentoTipo = document.getElementById('lancamento-tipo')
const campoLancamentoDescricao = document.getElementById('lancamento-descricao')
const campoLancamentoCategoria = document.getElementById('lancamento-categoria')
const campoLancamentoValor = document.getElementById('lancamento-valor')
const campoLancamentoData = document.getElementById('lancamento-data')
const campoLancamentoConta = document.getElementById('lancamento-conta')
const tituloModalLancamento = document.getElementById('modal-titulo-lancamento')

const formularioCategoria = document.getElementById('formulario-categoria')
const campoCategoriaId = document.getElementById('categoria-id')
const campoCategoriaNome = document.getElementById('categoria-nome')
const campoCategoriaTipo = document.getElementById('categoria-tipo')
const campoCategoriaCor = document.getElementById('categoria-cor')
const tituloModalCategoria = document.getElementById('modal-titulo-categoria')

const formularioConta = document.getElementById('formulario-conta')
const campoContaId = document.getElementById('conta-id')
const campoContaNome = document.getElementById('conta-nome')
const campoContaTipo = document.getElementById('conta-tipo')
const campoContaSaldoInicial = document.getElementById('conta-saldo-inicial')
const tituloModalConta = document.getElementById('modal-titulo-conta')

const corpoTabelaLancamentos = document.getElementById('tabela-lancamentos-corpo')
const campoFiltroLancamentos = document.getElementById('filtro-lancamentos')
const campoFiltroTipo = document.getElementById('filtro-tipo')
const campoFiltroCategoria = document.getElementById('filtro-categoria')
const gradeCategorias = document.getElementById('grade-categorias')
const listaContas = document.getElementById('lista-contas')

function preencherSelecaoCategorias(selectElemento) {
  if (!selectElemento) return
  const valorAtual = selectElemento.value
  while (selectElemento.options.length > 1) selectElemento.remove(1)

  categorias.forEach((categoria) => {
    const opcao = document.createElement('option')
    opcao.value = categoria.id
    opcao.textContent = categoria.nome
    selectElemento.appendChild(opcao)
  })

  if (valorAtual) selectElemento.value = valorAtual
}

function preencherSelecaoContas(selectElemento) {
  if (!selectElemento) return
  const valorAtual = selectElemento.value
  while (selectElemento.options.length > 1) selectElemento.remove(1)

  contas.forEach((conta) => {
    const opcao = document.createElement('option')
    opcao.value = conta.id
    opcao.textContent = conta.nome
    selectElemento.appendChild(opcao)
  })

  if (valorAtual) selectElemento.value = valorAtual
}

function prepararFormularioLancamento(lancamento = null) {
  preencherSelecaoCategorias(campoLancamentoCategoria)
  preencherSelecaoContas(campoLancamentoConta)

  if (lancamento) {
    if (tituloModalLancamento) tituloModalLancamento.textContent = 'Editar lançamento'
    if (campoLancamentoId) campoLancamentoId.value = lancamento.id
    if (campoLancamentoTipo) campoLancamentoTipo.value = lancamento.tipo
    if (campoLancamentoDescricao) campoLancamentoDescricao.value = lancamento.descricao
    if (campoLancamentoCategoria) campoLancamentoCategoria.value = lancamento.categoriaId
    if (campoLancamentoValor) campoLancamentoValor.value = lancamento.valor
    if (campoLancamentoData) campoLancamentoData.value = lancamento.data
    if (campoLancamentoConta) campoLancamentoConta.value = lancamento.contaId || ''
  } else {
    if (tituloModalLancamento) tituloModalLancamento.textContent = 'Novo lançamento'
    if (campoLancamentoId) campoLancamentoId.value = ''
    if (campoLancamentoTipo) campoLancamentoTipo.value = ''
    if (campoLancamentoDescricao) campoLancamentoDescricao.value = ''
    if (campoLancamentoCategoria) campoLancamentoCategoria.value = ''
    if (campoLancamentoValor) campoLancamentoValor.value = ''
    if (campoLancamentoData) campoLancamentoData.value = new Date().toISOString().slice(0, 10)
    if (campoLancamentoConta) campoLancamentoConta.value = ''
  }
}

function prepararFormularioCategoria(categoria = null) {
  if (categoria) {
    if (tituloModalCategoria) tituloModalCategoria.textContent = 'Editar categoria'
    if (campoCategoriaId) campoCategoriaId.value = categoria.id
    if (campoCategoriaNome) campoCategoriaNome.value = categoria.nome
    if (campoCategoriaTipo) campoCategoriaTipo.value = categoria.tipo
    if (campoCategoriaCor) campoCategoriaCor.value = categoria.cor || '#3498db'
  } else {
    if (tituloModalCategoria) tituloModalCategoria.textContent = 'Nova categoria'
    if (campoCategoriaId) campoCategoriaId.value = ''
    if (campoCategoriaNome) campoCategoriaNome.value = ''
    if (campoCategoriaTipo) campoCategoriaTipo.value = ''
    if (campoCategoriaCor) campoCategoriaCor.value = '#3498db'
  }
}

function prepararFormularioConta(conta = null) {
  if (conta) {
    if (tituloModalConta) tituloModalConta.textContent = 'Editar conta'
    if (campoContaId) campoContaId.value = conta.id
    if (campoContaNome) campoContaNome.value = conta.nome
    if (campoContaTipo) campoContaTipo.value = conta.tipo
    if (campoContaSaldoInicial) campoContaSaldoInicial.value = conta.saldoInicial
  } else {
    if (tituloModalConta) tituloModalConta.textContent = 'Nova conta'
    if (campoContaId) campoContaId.value = ''
    if (campoContaNome) campoContaNome.value = ''
    if (campoContaTipo) campoContaTipo.value = ''
    if (campoContaSaldoInicial) campoContaSaldoInicial.value = ''
  }
}

if (formularioLancamento) {
  formularioLancamento.addEventListener('submit', async (evento) => {
    evento.preventDefault()

    const tipo = campoLancamentoTipo.value.toLowerCase()
    const descricao = campoLancamentoDescricao.value.trim()
    const categoriaId = campoLancamentoCategoria.value
    const valor = Number(campoLancamentoValor.value)
    const data = campoLancamentoData.value
    const contaId = campoLancamentoConta.value || null

    if (!tipo || !descricao || !categoriaId || !valor || !data) {
      mostrarNotificacao('Preencha todos os campos obrigatórios.', 'aviso')
      return
    }

    if (valor <= 0) {
      mostrarNotificacao('O valor deve ser maior que zero.', 'aviso')
      return
    }

    try {
      const user = await obterUsuarioAtual()
      const payload = {
        user_id: user.id,
        account_id: contaId,
        category_id: categoriaId,
        description: descricao,
        amount: valor,
        type: tipo,
        transaction_date: data,
        notes: ''
      }

      const idExistente = campoLancamentoId.value
      let error

      if (idExistente) {
        ;({ error } = await clienteSupabase
          .from('transacoes')
          .update(payload)
          .eq('id', idExistente)
          .eq('user_id', user.id))
      } else {
        ;({ error } = await clienteSupabase
          .from('transacoes')
          .insert(payload))
      }

      if (error) throw error

      await carregarTransacoesSupabase(user)
      fecharModal(modalLancamento)
      mostrarNotificacao(idExistente ? 'Lançamento atualizado com sucesso!' : 'Lançamento criado com sucesso!', 'sucesso')
    } catch (erro) {
      console.error('Erro ao salvar lançamento:', erro)
      mostrarNotificacao('Erro ao salvar lançamento.', 'erro')
    }
  })
}

if (formularioCategoria) {
  formularioCategoria.addEventListener('submit', async (evento) => {
    evento.preventDefault()

    const nome = campoCategoriaNome.value.trim()
    const tipo = campoCategoriaTipo.value.toLowerCase()
    const cor = campoCategoriaCor.value || '#3498db'

    if (!nome || !tipo) {
      mostrarNotificacao('Preencha o nome e o tipo da categoria.', 'aviso')
      return
    }

    try {
      const user = await obterUsuarioAtual()
      const idExistente = campoCategoriaId.value
      let error

      if (idExistente) {
        ;({ error } = await clienteSupabase
          .from('categorias')
          .update({ name: nome, type: tipo, color: cor })
          .eq('id', idExistente)
          .eq('user_id', user.id))
      } else {
        ;({ error } = await clienteSupabase
          .from('categorias')
          .insert({ user_id: user.id, name: nome, type: tipo, color: cor }))
      }

      if (error) throw error

      await carregarCategoriasSupabase()
      fecharModal(modalCategoria)
      mostrarNotificacao(idExistente ? 'Categoria atualizada com sucesso!' : 'Categoria criada com sucesso!', 'sucesso')
    } catch (erro) {
      console.error('Erro ao salvar categoria:', erro)
      mostrarNotificacao('Erro ao salvar categoria.', 'erro')
    }
  })
}

if (formularioConta) {
  formularioConta.addEventListener('submit', async (evento) => {
    evento.preventDefault()

    const nome = campoContaNome.value.trim()
    const tipo = campoContaTipo.value.toLowerCase()
    const saldoInicial = campoContaSaldoInicial.value ? Number(campoContaSaldoInicial.value) : 0

    if (!nome || !tipo) {
      mostrarNotificacao('Preencha o nome e o tipo da conta.', 'aviso')
      return
    }

    try {
      const user = await obterUsuarioAtual()
      const idExistente = campoContaId.value
      let error

      if (idExistente) {
        ;({ error } = await clienteSupabase
          .from('contas')
          .update({ name: nome, type: tipo, initial_balance: saldoInicial })
          .eq('id', idExistente)
          .eq('user_id', user.id))
      } else {
        ;({ error } = await clienteSupabase
          .from('contas')
          .insert({ user_id: user.id, name: nome, type: tipo, initial_balance: saldoInicial }))
      }

      if (error) throw error

      await carregarContasSupabase(user)
      fecharModal(modalConta)
      mostrarNotificacao(idExistente ? 'Conta atualizada com sucesso!' : 'Conta criada com sucesso!', 'sucesso')
    } catch (erro) {
      console.error('Erro ao salvar conta:', erro)
      mostrarNotificacao('Erro ao salvar conta.', 'erro')
    }
  })
}

function prepararDadosGrafico(lancamentosDoPeriodo) {
  const mapaDias = new Map()
  const [ano, mes] = periodoSelecionado.split('-').map(Number)
  const quantidadeDias = new Date(ano, mes, 0).getDate()

  for (let dia = 1; dia <= quantidadeDias; dia += 1) {
    const chave = String(dia).padStart(2, '0')
    mapaDias.set(chave, { receitas: 0, despesas: 0 })
  }

  lancamentosDoPeriodo.forEach((lancamento) => {
    const chave = String(lancamento.data || '').slice(8, 10)
    if (!mapaDias.has(chave)) return

    const atual = mapaDias.get(chave)
    if (lancamento.tipo === 'receita') atual.receitas += Number(lancamento.valor)
    else atual.despesas += Number(lancamento.valor)
  })

  const dias = Array.from(mapaDias.keys())
  return {
    dias: dias.map((dia) => `${dia}/${periodoSelecionado.slice(5, 7)}`),
    receitas: dias.map((dia) => mapaDias.get(dia).receitas),
    despesas: dias.map((dia) => mapaDias.get(dia).despesas)
  }
}

function atualizarGraficoMovimentacoes(lancamentosDoPeriodo) {
  const canvas = document.getElementById('grafico-movimentacoes')
  if (!canvas || typeof Chart === 'undefined') return

  const ctx = canvas.getContext('2d')
  const { dias, receitas, despesas } = prepararDadosGrafico(lancamentosDoPeriodo)

  if (graficoMovimentacoes) graficoMovimentacoes.destroy()

  graficoMovimentacoes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dias,
      datasets: [
        {
          label: 'Receitas',
          data: receitas,
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderRadius: 6,
          maxBarThickness: 40
        },
        {
          label: 'Despesas',
          data: despesas,
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderRadius: 6,
          maxBarThickness: 40
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatarMoeda(context.parsed.y || 0)}`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            font: { size: 11 },
            maxTicksLimit: 16
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 11 },
            callback: (valor) => formatarMoeda(valor)
          }
        }
      }
    }
  })
}

function atualizarDashboard() {
  const lancamentosDoPeriodo = obterLancamentosDoPeriodo()
  const valorReceitas = lancamentosDoPeriodo
    .filter((lancamento) => lancamento.tipo === 'receita')
    .reduce((soma, lancamento) => soma + Number(lancamento.valor), 0)

  const valorDespesas = lancamentosDoPeriodo
    .filter((lancamento) => lancamento.tipo === 'despesa')
    .reduce((soma, lancamento) => soma + Number(lancamento.valor), 0)

  const elementoReceitas = document.getElementById('card-receitas-valor')
  const elementoDespesas = document.getElementById('card-despesas-valor')
  const elementoSaldo = document.getElementById('card-saldo-valor')

  if (elementoReceitas) elementoReceitas.textContent = formatarMoeda(valorReceitas)
  if (elementoDespesas) elementoDespesas.textContent = formatarMoeda(valorDespesas)
  if (elementoSaldo) elementoSaldo.textContent = formatarMoeda(valorReceitas - valorDespesas)

  atualizarTextosDoPeriodo()

  const listaUltimosLancamentos = document.getElementById('lista-ultimos-lancamentos')
  if (listaUltimosLancamentos) {
    listaUltimosLancamentos.innerHTML = ''
    const ultimos = [...lancamentosDoPeriodo]
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, 5)

    if (ultimos.length === 0) {
      const vazio = document.createElement('p')
      vazio.classList.add('aviso-grafico')
      vazio.textContent = `Nenhum lançamento em ${obterTituloPeriodo()}.`
      listaUltimosLancamentos.appendChild(vazio)
    }

    ultimos.forEach((lancamento) => {
      const categoria = obterCategoriaPorId(lancamento.categoriaId)
      const item = document.createElement('div')
      item.classList.add('item-lancamento', lancamento.tipo)

      const info = document.createElement('div')
      info.classList.add('lancamento-info')

      const titulo = document.createElement('div')
      titulo.classList.add('lancamento-titulo')
      titulo.textContent = lancamento.descricao

      const detalhes = document.createElement('div')
      detalhes.classList.add('lancamento-detalhes')
      detalhes.textContent = `Categoria: ${categoria ? categoria.nome : 'Sem categoria'} • ${formatarData(lancamento.data) || 'Sem data'}`

      const valor = document.createElement('div')
      valor.classList.add('lancamento-valor', lancamento.tipo)
      valor.textContent = `${lancamento.tipo === 'receita' ? '+ ' : '- '}${formatarMoeda(lancamento.valor)}`

      info.appendChild(titulo)
      info.appendChild(detalhes)
      item.appendChild(info)
      item.appendChild(valor)
      listaUltimosLancamentos.appendChild(item)
    })
  }

  atualizarGraficoMovimentacoes(lancamentosDoPeriodo)
}

function listarLancamentos() {
  if (!corpoTabelaLancamentos) return

  const termoBusca = campoFiltroLancamentos ? campoFiltroLancamentos.value.toLowerCase() : ''
  const tipoFiltro = campoFiltroTipo ? campoFiltroTipo.value.toLowerCase() : ''
  const categoriaFiltro = campoFiltroCategoria ? campoFiltroCategoria.value : ''

  let listaFiltrada = [...lancamentos]
  if (termoBusca) listaFiltrada = listaFiltrada.filter((lancamento) => lancamento.descricao.toLowerCase().includes(termoBusca))
  if (tipoFiltro) listaFiltrada = listaFiltrada.filter((lancamento) => lancamento.tipo === tipoFiltro)
  if (categoriaFiltro) listaFiltrada = listaFiltrada.filter((lancamento) => String(lancamento.categoriaId) === String(categoriaFiltro))

  listaFiltrada.sort((a, b) => new Date(b.data) - new Date(a.data))
  corpoTabelaLancamentos.innerHTML = ''

  listaFiltrada.forEach((lancamento) => {
    const categoria = obterCategoriaPorId(lancamento.categoriaId)
    const linha = document.createElement('tr')

    const colunaData = document.createElement('td')
    colunaData.textContent = formatarData(lancamento.data)

    const colunaDescricao = document.createElement('td')
    colunaDescricao.textContent = lancamento.descricao

    const colunaCategoria = document.createElement('td')
    colunaCategoria.textContent = categoria ? categoria.nome : 'Sem categoria'

    const colunaTipo = document.createElement('td')
    colunaTipo.textContent = lancamento.tipo === 'receita' ? 'Receita' : 'Despesa'

    const colunaValor = document.createElement('td')
    colunaValor.textContent = formatarMoeda(lancamento.valor)

    const colunaAcoes = document.createElement('td')
    const botoes = document.createElement('div')
    botoes.classList.add('botoes-tabela')

    const botaoEditar = document.createElement('button')
    botaoEditar.classList.add('botao-acao', 'botao-editar')
    botaoEditar.textContent = 'Editar'
    botaoEditar.addEventListener('click', () => {
      prepararFormularioLancamento(lancamento)
      abrirModal(modalLancamento)
    })

    const botaoExcluir = document.createElement('button')
    botaoExcluir.classList.add('botao-acao', 'botao-excluir')
    botaoExcluir.textContent = 'Excluir'
    botaoExcluir.addEventListener('click', () => {
      pedirConfirmacao('Tem certeza que deseja excluir este lançamento?', async () => {
        try {
          const user = await obterUsuarioAtual()
          const { error } = await clienteSupabase
            .from('transacoes')
            .delete()
            .eq('id', lancamento.id)
            .eq('user_id', user.id)

          if (error) throw error
          await carregarTransacoesSupabase(user)
          mostrarNotificacao('Lançamento excluído com sucesso!', 'sucesso')
        } catch (erro) {
          console.error('Erro ao excluir lançamento:', erro)
          mostrarNotificacao('Erro ao excluir lançamento.', 'erro')
        }
      })
    })

    botoes.appendChild(botaoEditar)
    botoes.appendChild(botaoExcluir)
    colunaAcoes.appendChild(botoes)

    linha.appendChild(colunaData)
    linha.appendChild(colunaDescricao)
    linha.appendChild(colunaCategoria)
    linha.appendChild(colunaTipo)
    linha.appendChild(colunaValor)
    linha.appendChild(colunaAcoes)
    corpoTabelaLancamentos.appendChild(linha)
  })
}

function listarCategorias() {
  if (!gradeCategorias) return
  gradeCategorias.innerHTML = ''

  if (categorias.length === 0) {
    const vazio = document.createElement('p')
    vazio.textContent = 'Nenhuma categoria cadastrada ainda.'
    gradeCategorias.appendChild(vazio)
    return
  }

  categorias.forEach((categoria) => {
    const cartao = document.createElement('div')
    cartao.classList.add('cartao-categoria')
    cartao.style.borderLeftColor = categoria.cor || '#3498db'

    const nome = document.createElement('div')
    nome.classList.add('categoria-nome')
    nome.textContent = categoria.nome

    const tipo = document.createElement('div')
    tipo.classList.add('categoria-tipo')
    tipo.textContent = categoria.tipo === 'receita' ? 'Receita' : 'Despesa'

    const botoes = document.createElement('div')
    botoes.classList.add('botoes-tabela')

    const botaoEditar = document.createElement('button')
    botaoEditar.classList.add('botao-acao', 'botao-editar')
    botaoEditar.textContent = 'Editar'
    botaoEditar.addEventListener('click', () => {
      prepararFormularioCategoria(categoria)
      abrirModal(modalCategoria)
    })

    const botaoExcluir = document.createElement('button')
    botaoExcluir.classList.add('botao-acao', 'botao-excluir')
    botaoExcluir.textContent = 'Excluir'
    botaoExcluir.addEventListener('click', () => {
      pedirConfirmacao('Tem certeza que deseja excluir esta categoria?', async () => {
        try {
          const user = await obterUsuarioAtual()
          const { error } = await clienteSupabase
            .from('categorias')
            .delete()
            .eq('id', categoria.id)
            .eq('user_id', user.id)

          if (error) throw error
          await carregarCategoriasSupabase()
          mostrarNotificacao('Categoria excluída com sucesso!', 'sucesso')
        } catch (erro) {
          console.error('Erro ao excluir categoria:', erro)
          mostrarNotificacao('Erro ao excluir categoria.', 'erro')
        }
      })
    })

    botoes.appendChild(botaoEditar)
    botoes.appendChild(botaoExcluir)
    cartao.appendChild(nome)
    cartao.appendChild(tipo)
    cartao.appendChild(botoes)
    gradeCategorias.appendChild(cartao)
  })
}

function listarContas() {
  if (!listaContas) return
  listaContas.innerHTML = ''

  if (contas.length === 0) {
    const vazio = document.createElement('p')
    vazio.textContent = 'Nenhuma conta cadastrada ainda.'
    listaContas.appendChild(vazio)
    return
  }

  contas.forEach((conta) => {
    const cartao = document.createElement('div')
    cartao.classList.add('cartao-conta')

    const info = document.createElement('div')
    info.classList.add('conta-info')

    const nome = document.createElement('div')
    nome.classList.add('conta-nome')
    nome.textContent = conta.nome

    const tipo = document.createElement('div')
    tipo.classList.add('conta-tipo')
    const nomesTipos = {
      'conta-corrente': 'Conta corrente',
      poupanca: 'Poupança',
      'cartao-credito': 'Cartão de crédito',
      outro: 'Outro'
    }
    tipo.textContent = nomesTipos[conta.tipo] || conta.tipo

    const saldo = document.createElement('div')
    saldo.classList.add('conta-saldo')
    saldo.textContent = `Saldo inicial: ${formatarMoeda(conta.saldoInicial || 0)}`

    const botoes = document.createElement('div')
    botoes.classList.add('botoes-tabela')

    const botaoEditar = document.createElement('button')
    botaoEditar.classList.add('botao-acao', 'botao-editar')
    botaoEditar.textContent = 'Editar'
    botaoEditar.addEventListener('click', () => {
      prepararFormularioConta(conta)
      abrirModal(modalConta)
    })

    const botaoExcluir = document.createElement('button')
    botaoExcluir.classList.add('botao-acao', 'botao-excluir')
    botaoExcluir.textContent = 'Excluir'
    botaoExcluir.addEventListener('click', () => {
      pedirConfirmacao('Tem certeza que deseja excluir esta conta?', async () => {
        try {
          const user = await obterUsuarioAtual()
          const { error } = await clienteSupabase
            .from('contas')
            .delete()
            .eq('id', conta.id)
            .eq('user_id', user.id)

          if (error) throw error
          await carregarContasSupabase(user)
          mostrarNotificacao('Conta excluída com sucesso!', 'sucesso')
        } catch (erro) {
          console.error('Erro ao excluir conta:', erro)
          mostrarNotificacao('Erro ao excluir conta.', 'erro')
        }
      })
    })

    botoes.appendChild(botaoEditar)
    botoes.appendChild(botaoExcluir)
    info.appendChild(nome)
    info.appendChild(tipo)
    info.appendChild(saldo)
    cartao.appendChild(info)
    cartao.appendChild(botoes)
    listaContas.appendChild(cartao)
  })
}

function escaparCsv(valor) {
  const texto = String(valor ?? '')
  return `"${texto.replaceAll('"', '""')}"`
}

function exportarRelatorioDoPeriodo() {
  const lancamentosDoPeriodo = [...obterLancamentosDoPeriodo()]
    .sort((a, b) => new Date(a.data) - new Date(b.data))

  const totalReceitas = lancamentosDoPeriodo
    .filter((lancamento) => lancamento.tipo === 'receita')
    .reduce((soma, lancamento) => soma + Number(lancamento.valor), 0)

  const totalDespesas = lancamentosDoPeriodo
    .filter((lancamento) => lancamento.tipo === 'despesa')
    .reduce((soma, lancamento) => soma + Number(lancamento.valor), 0)

  const linhas = [
    ['Relatório financeiro', obterTituloPeriodo()],
    ['Receitas', totalReceitas.toFixed(2)],
    ['Despesas', totalDespesas.toFixed(2)],
    ['Saldo', (totalReceitas - totalDespesas).toFixed(2)],
    [],
    ['Data', 'Descrição', 'Categoria', 'Conta', 'Tipo', 'Valor']
  ]

  lancamentosDoPeriodo.forEach((lancamento) => {
    const categoria = obterCategoriaPorId(lancamento.categoriaId)
    const conta = obterContaPorId(lancamento.contaId)
    linhas.push([
      formatarData(lancamento.data),
      lancamento.descricao,
      categoria ? categoria.nome : 'Sem categoria',
      conta ? conta.nome : 'Sem conta',
      lancamento.tipo === 'receita' ? 'Receita' : 'Despesa',
      Number(lancamento.valor).toFixed(2)
    ])
  })

  const csv = '\uFEFF' + linhas
    .map((linha) => linha.map(escaparCsv).join(';'))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `relatorio-fluxomei-${periodoSelecionado}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)

  mostrarNotificacao(`Relatório de ${obterTituloPeriodo()} exportado em CSV.`, 'sucesso')
}

if (campoFiltroLancamentos) campoFiltroLancamentos.addEventListener('input', listarLancamentos)
if (campoFiltroTipo) campoFiltroTipo.addEventListener('change', listarLancamentos)
if (campoFiltroCategoria) campoFiltroCategoria.addEventListener('change', listarLancamentos)

if (seletorPeriodo) {
  seletorPeriodo.addEventListener('change', () => {
    periodoSelecionado = seletorPeriodo.value
    atualizarDashboard()
  })
}

if (botaoExportar) botaoExportar.addEventListener('click', exportarRelatorioDoPeriodo)

async function executarComRetryDeSessao(operacao) {
  const resultado = await operacao()
  if (resultado.error?.code === 'PGRST303') {
    console.warn('Sessão com horário desincronizado, tentando renovar...')
    await clienteSupabase.auth.refreshSession()
    return await operacao()
  }
  return resultado
}

async function obterUsuarioAtual() {
  if (sessaoAtual?.user) {
    return sessaoAtual.user
  }

  const sessao = await verificarSessaoDashboard()

  if (!sessao) {
    throw new Error('Usuário não autenticado.')
  }

  sessaoAtual = sessao
  return sessao.user
}
async function carregarCategoriasSupabase() {
  const user = await obterUsuarioAtual()
  const { data, error } = await executarComRetryDeSessao(() =>
  clienteSupabase
    .from('categorias')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })
)

  if (error) {
    console.error('Erro ao carregar categorias:', error)
    mostrarNotificacao('Erro ao carregar categorias.', 'erro')
    return
  }

  categorias = (data || []).map((categoria) => ({
    id: categoria.id,
    nome: categoria.name,
    tipo: String(categoria.type || '').toLowerCase(),
    cor: categoria.color || '#3498db'
  }))

  listarCategorias()
  preencherSelecaoCategorias(campoLancamentoCategoria)
  preencherSelecaoCategorias(campoFiltroCategoria)
}

async function carregarContasSupabase(user) {
 const { data, error } = await executarComRetryDeSessao(() =>
  clienteSupabase
    .from('contas')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })
)

  if (error) {
    console.error('Erro ao carregar contas:', error)
    mostrarNotificacao('Erro ao carregar contas.', 'erro')
    return
  }

  contas = (data || []).map((conta) => ({
    id: conta.id,
    nome: conta.name,
    tipo: String(conta.type || '').toLowerCase(),
    saldoInicial: Number(conta.initial_balance || 0)
  }))

  listarContas()
  preencherSelecaoContas(campoLancamentoConta)
}

async function carregarTransacoesSupabase(user) {
  const { data, error } = await executarComRetryDeSessao(() =>
  clienteSupabase
    .from('transacoes')
    .select('*')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
)

  if (error) {
    console.error('Erro ao carregar transações:', error)
    mostrarNotificacao('Erro ao carregar lançamentos.', 'erro')
    return
  }

  lancamentos = (data || []).map((transacao) => ({
    id: transacao.id,
    tipo: String(transacao.type || '').toLowerCase(),
    descricao: transacao.description,
    categoriaId: transacao.category_id,
    valor: Number(transacao.amount || 0),
    data: transacao.transaction_date,
    contaId: transacao.account_id,
    notes: transacao.notes || '',
    isRecurring: Boolean(transacao.is_recurring)
  }))

  preencherSeletorPeriodo()
  atualizarDashboard()
  listarLancamentos()
}

async function carregarRecorrenciasSupabase(user) {
  const { data, error } = await executarComRetryDeSessao(() =>
  clienteSupabase
    .from('recorrencias')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
)
  if (error) {
    console.error('Erro ao carregar recorrências:', error)
    return
  }

  recurrences = data || []
}

async function realizarLogout() {
  const { error } = await clienteSupabase.auth.signOut()
  if (error) {
    console.error('Erro ao sair:', error)
    mostrarNotificacao('Erro ao encerrar sessão.', 'erro')
    return
  }
  window.location.replace('login.html')
}

const botaoLogout = document.getElementById('botao-logout')
if (botaoLogout) {
  botaoLogout.addEventListener('click', () => {
    pedirConfirmacao('Tem certeza que deseja sair da sua conta?', realizarLogout)
  })
}

async function verificarSessaoDashboard() {
  const {
    data: { session },
    error
  } = await clienteSupabase.auth.getSession()

  if (error) {
    console.error('Erro ao verificar sessão:', error)
    window.location.replace('login.html')
    return null
  }

  if (!session) {
    window.location.replace('login.html')
    return null
  }

  sessaoAtual = session
  return session
}

async function inicializarAplicacao() {
  const sessao = await verificarSessaoDashboard()
  if (!sessao) return

  document.getElementById('tela-carregamento')?.remove()

  alterarTelaAtiva('dashboard')
  preencherSeletorPeriodo()

  try {
    usuarioAtual = sessao.user
    const elementoEmailUsuario = document.getElementById('usuario-email-atual')
    if (elementoEmailUsuario) elementoEmailUsuario.textContent = usuarioAtual.email
    await Promise.all([
      carregarCategoriasSupabase(),
      carregarContasSupabase(usuarioAtual),
      carregarTransacoesSupabase(usuarioAtual),
      carregarRecorrenciasSupabase(usuarioAtual)
    ])
  } catch (erro) {
    console.error('Erro ao inicializar aplicação:', erro)
    mostrarNotificacao('Erro ao carregar dados do servidor.', 'erro')
    return
  }

  atualizarDashboard()
  listarLancamentos()
  listarCategorias()
  listarContas()
  preencherSelecaoCategorias(campoFiltroCategoria)
  preencherSelecaoCategorias(campoLancamentoCategoria)
  preencherSelecaoContas(campoLancamentoConta)
}

  atualizarDashboard()
  listarLancamentos()
  listarCategorias()
  listarContas()
  preencherSelecaoCategorias(campoFiltroCategoria)
  preencherSelecaoCategorias(campoLancamentoCategoria)
  preencherSelecaoContas(campoLancamentoConta)


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarAplicacao)
} else {
  inicializarAplicacao()
}
