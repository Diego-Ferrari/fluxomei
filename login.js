// FLUXOMEI - Autenticação com Supabase Auth

const SUPABASE_URL = 'https://yvtqfczkxjmzeyjqvxls.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_Pid_-CzlIWhlYp-vZms79g_NWbsOfKf'
const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const formulario = document.getElementById('formulario-login')
const campoEmail = document.getElementById('email')
const campoSenha = document.getElementById('senha')
const lembrarAcesso = document.getElementById('lembrar-acesso')
const botaoEnviar = document.getElementById('botao-enviar')
const textoBotaoEnviar = document.getElementById('texto-botao-enviar')
const botaoAlternarModo = document.getElementById('botao-alternar-modo')
const textoAlternar = document.getElementById('texto-alternar')
const tituloFormulario = document.getElementById('titulo-formulario')
const textoFormulario = document.getElementById('texto-formulario')
const botaoMostrarSenha = document.getElementById('botao-mostrar-senha')
const botaoEsqueciSenha = document.getElementById('botao-esqueci-senha')
const linhaOpcoes = document.getElementById('linha-opcoes')
const mensagemLogin = document.getElementById('mensagem-login')
const textoMensagem = document.getElementById('texto-mensagem')
const iconeMensagem = document.getElementById('icone-mensagem')

let modoCadastro = false

function mostrarMensagem(mensagem, tipo = 'erro') {
  mensagemLogin.className = `mensagem visivel ${tipo}`
  textoMensagem.textContent = mensagem
  iconeMensagem.className = tipo === 'sucesso'
    ? 'fas fa-circle-check'
    : 'fas fa-circle-exclamation'
}

function esconderMensagem() {
  mensagemLogin.className = 'mensagem'
  textoMensagem.textContent = ''
}

function definirCarregando(ativo) {
  botaoEnviar.disabled = ativo

  if (ativo) {
    textoBotaoEnviar.textContent = modoCadastro ? 'Criando conta...' : 'Entrando...'
    botaoEnviar.querySelector('i').className = 'fas fa-spinner fa-spin'
    return
  }

  textoBotaoEnviar.textContent = modoCadastro ? 'Criar conta' : 'Entrar'
  botaoEnviar.querySelector('i').className = modoCadastro
    ? 'fas fa-user-plus'
    : 'fas fa-right-to-bracket'
}

function configurarBotaoAlternarModo() {
  const novoBotao = document.getElementById('botao-alternar-modo')
  if (novoBotao) novoBotao.addEventListener('click', atualizarModo)
}

function atualizarModo() {
  esconderMensagem()
  modoCadastro = !modoCadastro
  campoSenha.autocomplete = modoCadastro ? 'new-password' : 'current-password'

  if (modoCadastro) {
    tituloFormulario.textContent = 'Crie sua conta'
    textoFormulario.textContent = 'Cadastre-se para começar a organizar as finanças do seu MEI.'
    textoBotaoEnviar.textContent = 'Criar conta'
    botaoEnviar.querySelector('i').className = 'fas fa-user-plus'
    textoAlternar.innerHTML = 'Já possui uma conta? <button id="botao-alternar-modo" class="link-simples" type="button">Entrar</button>'
    linhaOpcoes.style.display = 'none'
  } else {
    tituloFormulario.textContent = 'Bem-vindo de volta'
    textoFormulario.textContent = 'Entre com seus dados para acessar seu controle financeiro.'
    textoBotaoEnviar.textContent = 'Entrar'
    botaoEnviar.querySelector('i').className = 'fas fa-right-to-bracket'
    textoAlternar.innerHTML = 'Ainda não possui uma conta? <button id="botao-alternar-modo" class="link-simples" type="button">Criar conta</button>'
    linhaOpcoes.style.display = 'flex'
  }

  configurarBotaoAlternarModo()
}

function normalizarMensagemErro(erro) {
  const mensagem = String(erro?.message || '').toLowerCase()

  if (mensagem.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }

  if (mensagem.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar na conta.'
  }

  if (mensagem.includes('user already registered')) {
    return 'Já existe uma conta cadastrada com este e-mail.'
  }

  if (mensagem.includes('password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.'
  }

  if (mensagem.includes('unable to validate email address')) {
    return 'Informe um endereço de e-mail válido.'
  }

  if (mensagem.includes('email rate limit exceeded')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  }

  return erro?.message || 'Não foi possível concluir a solicitação. Tente novamente.'
}

async function verificarSessaoExistente() {
  const { data, error } = await clienteSupabase.auth.getSession()

  if (error) {
    console.error('Erro ao verificar sessão:', error)
    return
  }

  if (data.session) {
    window.location.replace('index.html')
  }
}

async function entrar(email, senha) {
  const { data, error } = await clienteSupabase.auth.signInWithPassword({
    email,
    password: senha
  })

  if (error) throw error
  if (!data.session) throw new Error('Não foi possível iniciar a sessão. Confirme seu e-mail e tente novamente.')

  window.location.replace('index.html')
}

async function criarConta(email, senha) {
  const urlAtual = new URL(window.location.href)
  const urlDeRetorno = `${urlAtual.origin}${urlAtual.pathname.replace(/[^/]*$/, '')}index.html`

  const { data, error } = await clienteSupabase.auth.signUp({
    email,
    password: senha,
    options: {
      emailRedirectTo: urlDeRetorno
    }
  })

  if (error) throw error

  if (data.session) {
    window.location.replace('index.html')
    return
  }

  mostrarMensagem('Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.', 'sucesso')
}

async function enviarRecuperacaoSenha() {
  esconderMensagem()

  const email = campoEmail.value.trim()
  if (!email || !campoEmail.checkValidity()) {
    mostrarMensagem('Digite um e-mail válido no campo acima para recuperar sua senha.')
    campoEmail.focus()
    return
  }

  const urlAtual = new URL(window.location.href)
  const urlDeRetorno = `${urlAtual.origin}${urlAtual.pathname.replace(/[^/]*$/, '')}login.html`

  botaoEsqueciSenha.disabled = true
  botaoEsqueciSenha.textContent = 'Enviando...'

  try {
    const { error } = await clienteSupabase.auth.resetPasswordForEmail(email, {
      redirectTo: urlDeRetorno
    })

    if (error) throw error

    mostrarMensagem('Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.', 'sucesso')
  } catch (erro) {
    console.error('Erro ao solicitar recuperação de senha:', erro)
    mostrarMensagem(normalizarMensagemErro(erro))
  } finally {
    botaoEsqueciSenha.disabled = false
    botaoEsqueciSenha.textContent = 'Esqueci minha senha'
  }
}

if (botaoAlternarModo) botaoAlternarModo.addEventListener('click', atualizarModo)

if (botaoMostrarSenha) {
  botaoMostrarSenha.addEventListener('click', () => {
    const senhaVisivel = campoSenha.type === 'text'
    campoSenha.type = senhaVisivel ? 'password' : 'text'
    botaoMostrarSenha.querySelector('i').className = senhaVisivel ? 'fas fa-eye' : 'fas fa-eye-slash'
    botaoMostrarSenha.setAttribute('aria-label', senhaVisivel ? 'Mostrar senha' : 'Ocultar senha')
  })
}

if (botaoEsqueciSenha) botaoEsqueciSenha.addEventListener('click', enviarRecuperacaoSenha)

if (formulario) {
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    esconderMensagem()

    const email = campoEmail.value.trim()
    const senha = campoSenha.value

    if (!email || !senha) {
      mostrarMensagem('Preencha seu e-mail e sua senha para continuar.')
      return
    }

    if (!campoEmail.checkValidity()) {
      mostrarMensagem('Informe um endereço de e-mail válido.')
      campoEmail.focus()
      return
    }

    if (senha.length < 6) {
      mostrarMensagem('A senha deve ter pelo menos 6 caracteres.')
      campoSenha.focus()
      return
    }

    try {
      definirCarregando(true)

      if (modoCadastro) {
        await criarConta(email, senha)
      } else {
        await entrar(email, senha)
      }
    } catch (erro) {
      console.error('Erro na autenticação:', erro)
      mostrarMensagem(normalizarMensagemErro(erro))
    } finally {
      definirCarregando(false)
    }
  })
}

verificarSessaoExistente()
