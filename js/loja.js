// ==========================================
// loja.js - Loja pública do restaurante (Hortaliças Jogi)
// ==========================================

const CONFIG = {
  whatsappNumero: "5561996433209", // número da Jogi para onde o pedido é enviado, 
};

let clienteAtual = null; // { id, nome, slug, ... }
let produtosDisponiveis = [];
let carrinho = {}; // { produtoId: { produto, quantidade } }

// ==========================================
// 1. Identificar cliente pela URL (?cliente=slug)
// ==========================================
async function identificarCliente() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("cliente");

  if (!slug) {
    mostrarTelaInvalida();
    return false;
  }

  const { data, error } = await supabaseClient
    .from("clientes")
    .select("*")
    .eq("slug", slug)
    .eq("ativo", true)
    .single();

  if (error || !data) {
    console.error("Cliente não encontrado:", error);
    mostrarTelaInvalida();
    return false;
  }

  clienteAtual = data;
  document.getElementById("nome-restaurante").textContent = clienteAtual.nome;
  document.getElementById("tela-loja").classList.remove("escondido");
  return true;
}

function mostrarTelaInvalida() {
  document.getElementById("tela-invalida").classList.remove("escondido");
  document.getElementById("tela-loja").classList.add("escondido");

  const btnWhatsapp = document.getElementById("btn-whatsapp-contato");
  if (btnWhatsapp) {
    const mensagem = encodeURIComponent(
      "Olá! Encontrei o site da Hortaliças Jogi e quero saber mais sobre fazer pedidos para o meu restaurante."
    );
    btnWhatsapp.href = `https://wa.me/${CONFIG.whatsappNumero}?text=${mensagem}`;
  }
}

// ==========================================
// 2. Carregar e renderizar produtos
// ==========================================
async function carregarProdutos() {
  const { data, error } = await supabaseClient
    .from("produtos")
    .select("*")
    .eq("disponivel", true)
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar produtos:", error);
    return;
  }

  produtosDisponiveis = data;
  renderizarProdutos(produtosDisponiveis);
}

function renderizarProdutos(produtos) {
  const grid = document.getElementById("grid-produtos");
  grid.innerHTML = "";

  if (produtos.length === 0) {
    grid.innerHTML = `<p>Nenhum produto disponível no momento.</p>`;
    return;
  }

  produtos.forEach((produto) => {
    const card = document.createElement("div");
    card.className = "card-produto";
    card.innerHTML = `
      <img src="${produto.imagem_url || ""}" alt="${produto.nome}" class="card-produto-imagem">
      <h3 class="card-produto-nome">${produto.nome}</h3>
      <p class="card-produto-descricao">${produto.descricao || ""}</p>
      <p class="card-produto-preco">${formatarPreco(produto.preco)} / ${produto.unidade}</p>
      <div class="card-produto-acoes">
        <input type="number" id="qtd-${produto.id}" min="1" value="1" class="input-quantidade">
        <button class="botao-primario btn-adicionar-carrinho" data-produto-id="${produto.id}">
          Adicionar
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  document.querySelectorAll(".btn-adicionar-carrinho").forEach((btn) => {
    btn.addEventListener("click", () => {
      const produtoId = btn.dataset.produtoId;
      const quantidadeInput = document.getElementById(`qtd-${produtoId}`);
      const quantidade = parseInt(quantidadeInput.value) || 1;
      adicionarAoCarrinho(produtoId, quantidade);
      mostrarToast(`${nomeProdutoPorId(produtoId)} adicionado ao carrinho`);
    });
  });
}

function nomeProdutoPorId(produtoId) {
  const produto = produtosDisponiveis.find((p) => String(p.id) === String(produtoId));
  return produto ? produto.nome : "Item";
}

// ==========================================
// 3. Carrinho (com persistência em localStorage, isolado por cliente/slug)
// ==========================================
function chaveCarrinhoStorage() {
  return `carrinho_${clienteAtual?.slug || "geral"}`;
}

function salvarCarrinhoStorage() {
  localStorage.setItem(chaveCarrinhoStorage(), JSON.stringify(carrinho));
}

function carregarCarrinhoStorage() {
  const salvo = localStorage.getItem(chaveCarrinhoStorage());
  carrinho = salvo ? JSON.parse(salvo) : {};
}

function adicionarAoCarrinho(produtoId, quantidade) {
  const produto = produtosDisponiveis.find((p) => String(p.id) === String(produtoId));
  if (!produto) return;

  if (carrinho[produtoId]) {
    carrinho[produtoId].quantidade += quantidade;
  } else {
    carrinho[produtoId] = { produto, quantidade };
  }

  salvarCarrinhoStorage();
  renderizarCarrinho();
}

function removerDoCarrinho(produtoId) {
  delete carrinho[produtoId];
  salvarCarrinhoStorage();
  renderizarCarrinho();
}

function atualizarQuantidadeCarrinho(produtoId, novaQuantidade) {
  if (!carrinho[produtoId]) return;

  if (novaQuantidade <= 0) {
    removerDoCarrinho(produtoId);
    return;
  }

  carrinho[produtoId].quantidade = novaQuantidade;
  salvarCarrinhoStorage();
  renderizarCarrinho();
}

function calcularTotalCarrinho() {
  return Object.values(carrinho).reduce((soma, item) => {
    return soma + item.produto.preco * item.quantidade;
  }, 0);
}

function calcularQuantidadeTotalCarrinho() {
  return Object.values(carrinho).reduce((soma, item) => soma + item.quantidade, 0);
}

function renderizarCarrinho() {
  const lista = document.getElementById("carrinho-lista");
  const totalEl = document.getElementById("carrinho-total");
  const contadorEl = document.getElementById("cartCount");

  const itens = Object.entries(carrinho);

  lista.innerHTML = "";

  if (itens.length === 0) {
    lista.innerHTML = `<p class="carrinho-vazio">Seu carrinho está vazio.</p>`;
  }

  itens.forEach(([produtoId, item]) => {
    const subtotal = item.produto.preco * item.quantidade;

    const linha = document.createElement("div");
    linha.className = "carrinho-item";
    linha.innerHTML = `
      <span class="carrinho-item-nome">${item.produto.nome}</span>
      <input type="number" min="1" value="${item.quantidade}" class="input-quantidade carrinho-item-qtd" data-produto-id="${produtoId}">
      <span class="carrinho-item-subtotal">${formatarPreco(subtotal)}</span>
      <button class="botao-icone btn-remover-item" data-produto-id="${produtoId}">Remover</button>
    `;
    lista.appendChild(linha);
  });

  document.querySelectorAll(".carrinho-item-qtd").forEach((input) => {
    input.addEventListener("change", (e) => {
      const produtoId = e.target.dataset.produtoId;
      const novaQuantidade = parseInt(e.target.value) || 0;
      atualizarQuantidadeCarrinho(produtoId, novaQuantidade);
    });
  });

  document.querySelectorAll(".btn-remover-item").forEach((btn) => {
    btn.addEventListener("click", () => removerDoCarrinho(btn.dataset.produtoId));
  });

  totalEl.textContent = formatarPreco(calcularTotalCarrinho());

  if (contadorEl) {
    contadorEl.textContent = calcularQuantidadeTotalCarrinho();
  }
}

// ==========================================
// 4. Abrir/fechar o drawer do carrinho
// ==========================================
function abrirCarrinho() {
  document.getElementById("cartDrawer").classList.remove("escondido");
}

function fecharCarrinho() {
  document.getElementById("cartDrawer").classList.add("escondido");
}

// ==========================================
// 5. Toast de feedback ("produto adicionado")
// ==========================================
let toastTimeout = null;

function mostrarToast(mensagem) {
  const toast = document.getElementById("cartToast");
  if (!toast) return;

  toast.textContent = mensagem;
  toast.classList.add("visivel");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("visivel");
  }, 2200);
}

// ==========================================
// 6. Finalizar pedido
// ==========================================
async function finalizarPedido() {
  const itensCarrinho = Object.values(carrinho);

  if (itensCarrinho.length === 0) {
    alert("Seu carrinho está vazio.");
    return;
  }

  if (!clienteAtual) {
    alert("Não foi possível identificar o restaurante. Recarregue a página.");
    return;
  }

  const btnFinalizar = document.getElementById("btn-finalizar-pedido");
  btnFinalizar.disabled = true;
  btnFinalizar.textContent = "Enviando pedido...";

  try {
    const itensParaSalvar = itensCarrinho.map((item) => ({
      produto: item.produto.nome,
      quantidade: item.quantidade,
      preco: item.produto.preco,
    }));

    const total = calcularTotalCarrinho();

    const { data: pedidoInserido, error } = await supabaseClient
      .from("pedidos")
      .insert([{
        cliente_id: clienteAtual.id,
        itens: itensParaSalvar,
        total: Number(total.toFixed(2)),
        status: "pendente",
      }])
      .select()
      .single();

    if (error) {
      console.error("Erro ao salvar pedido:", error);
      alert("Erro ao enviar pedido: " + error.message);
      return;
    }

    abrirWhatsApp(itensParaSalvar, total, pedidoInserido);

    carrinho = {};
    salvarCarrinhoStorage();
    renderizarCarrinho();
    fecharCarrinho();

    mostrarToast("Pedido enviado com sucesso!");

  } catch (erro) {
    console.error("Erro ao finalizar pedido:", erro);
    alert("Erro ao finalizar pedido: " + erro.message);
  } finally {
    btnFinalizar.disabled = false;
    btnFinalizar.textContent = "Finalizar pedido";
  }
}

// ==========================================
// 7. Mensagem do WhatsApp
// ==========================================
function abrirWhatsApp(itens, total, pedido) {
  const numeroPedido = String(pedido.id).padStart(3, "0");

  const dataFormatada = new Date(pedido.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let mensagem = `📋 *NOVO PEDIDO #${numeroPedido}*\n`;
  mensagem += `🏪 ${clienteAtual.nome}\n`;

  if (clienteAtual.responsavel) {
    mensagem += `👤 ${clienteAtual.responsavel}\n`;
  }

  mensagem += `📅 ${dataFormatada}\n\n`;

  mensagem += `🛒 *Itens:*\n`;
  itens.forEach((item) => {
    const subtotal = item.quantidade * item.preco;
    mensagem += `• ${item.quantidade}x ${item.produto} — ${formatarPreco(subtotal)}\n`;
  });

  mensagem += `\n💰 *Total: ${formatarPreco(total)}*`;

  if (clienteAtual.pagamento) {
    mensagem += `\n💳 Pagamento: ${clienteAtual.pagamento}`;
  }

  const mensagemCodificada = encodeURIComponent(mensagem);
  const url = `https://wa.me/${CONFIG.whatsappNumero}?text=${mensagemCodificada}`;

  window.open(url, "_blank");
}

// ==========================================
// Utilitário de formatação de preço
// ==========================================
function formatarPreco(valor) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ==========================================
// Inicialização
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  const clienteValido = await identificarCliente();
  if (!clienteValido) return;

  carregarCarrinhoStorage();
  await carregarProdutos();
  renderizarCarrinho();

  document.getElementById("cartBtn").addEventListener("click", abrirCarrinho);
  document.getElementById("btn-fechar-carrinho").addEventListener("click", fecharCarrinho);
  document.getElementById("btn-finalizar-pedido").addEventListener("click", finalizarPedido);
});