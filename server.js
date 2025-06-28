const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// Suas credenciais do Supabase
const SUPABASE_URL = "https://asditjyifyvityptdujg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZGl0anlpZnl2aXR5cHRkdWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNzAyNzcsImV4cCI6MjA2NDY0NjI3N30.Z3JoZSDw9-NdY_n4ijfI8cM6k1ZSCxNXnSGd2Wp3J7Q";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middleware para parsear JSON
app.use(bodyParser.json());

app.use(cors({
  origin: "*", // Permite todas as origens (em produção, especifique seus domínios)
  methods: ["GET", "POST", "OPTIONS"], // Métodos permitidos
  allowedHeaders: ["Content-Type", "Authorization"] // Cabeçalhos permitidos
}));

// Token de autorização da API GZAPPY
const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwdWJsaWNfaW5zdGFuY2VfaWQiOiJMUDFXSioqKioqKioqKioqKioqVzZRMEgiLCJleHBpcmVzX2F0IjoiMjAyNi0wNi0wMVQwNzowOToyOS42NzVaIiwiaWF0IjoxNzQ4NzYxNzY5LCJleHAiOjIzNTM1NjE3Njl9.5H7eFyNw9K8T3-jjfXu1uGNwvHYY6NQ3w7fYGKdVYRk";

// Função de atraso
const delay = ms => new Promise(res => setTimeout(res, ms));

// Rota de health check - raiz
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Servidor de mensagens está funcionando",
    timestamp: new Date().toISOString()
  });
});

// Rota para enviar mensagens
app.post("/enviar-mensagens", async (req, res) => {
  try {
    console.log(req.body);
    const { clientes, mensagem, tempo_de_disparo } = req.body;
    
    if (!clientes || !Array.isArray(clientes)) {
      return res.status(400).json({ success: false, message: "Lista de clientes inválida" });
    }
    
    if (!mensagem || typeof mensagem !== "string") {
      return res.status(400).json({ success: false, message: "Mensagem inválida" });
    }

    const delayInMs = (tempo_de_disparo || 0) * 1000; // Converte segundos para milissegundos

    let enviados = 0;
    const erros = [];
    
    // Enviar mensagem para cada cliente
    for (const cliente of clientes) {
      let mensagemPersonalizada = mensagem
        .replace(/{nome}/g, cliente.nome || "")
        .replace(/{fatura}/g, cliente.valor_fatura || "")
        .replace(/{data}/g, cliente.data_vencimento || "")
        .replace(/{cpf}/g, cliente.cpf || "");

      let statusDisparo = "sucesso";
      let detalhesErro = null;

      try {
        // Enviar mensagem via API GZAPPY
        const response = await fetch("https://v2-api.gzappy.com/message/send-text", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${API_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            phone: cliente.telefone,
            message: mensagemPersonalizada
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          statusDisparo = "erro";
          detalhesErro = data.message || "Erro ao enviar mensagem";
          throw new Error(detalhesErro);
        }

        enviados++;
      } catch (error) {
        statusDisparo = "erro";
        detalhesErro = error.message;
        erros.push({
          cliente: cliente.nome || "Cliente sem nome",
          telefone: cliente.telefone,
          erro: error.message
        });
      } finally {
        // Registrar o disparo no Supabase
        const { data: insertData, error: insertError } = await supabase
          .from("disparos")
          .insert([
            {
              telefone_cliente: cliente.telefone,
              mensagem: mensagemPersonalizada,
              status: statusDisparo,
              erro: detalhesErro
            }
          ]);

        if (insertError) {
          console.error("Erro ao registrar disparo no Supabase:", insertError);
        }
      }

      // Adiciona o atraso após cada envio, exceto o último
      if (delayInMs > 0 && clientes.indexOf(cliente) < clientes.length - 1) {
        await delay(delayInMs);
      }
    }

    res.json({
      success: true,
      total_clientes: clientes.length,
      mensagens_enviadas: enviados,
      erros: erros,
      message: `Foram enviadas ${enviados} mensagens com ${erros.length} erros.`
    });

  } catch (error) {
    console.error("Erro no servidor:", error);
    res.status(500).json({ success: false, message: "Erro interno no servidor" });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});


