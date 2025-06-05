const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Token de autorização da API GZAPPY
const API_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwdWJsaWNfaW5zdGFuY2VfaWQiOiJMUDFXSioqKioqKioqKioqKioqVzZRMEgiLCJleHBpcmVzX2F0IjoiMjAyNi0wNi0wMVQwNzowOToyOS42NzVaIiwiaWF0IjoxNzQ4NzYxNzY5LCJleHAiOjIzNTM1NjE3Njl9.5H7eFyNw9K8T3-jjfXu1uGNwvHYY6NQ3w7fYGKdVYRk';


// Rota de health check - raiz
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Servidor de mensagens está funcionando',
    timestamp: new Date().toISOString()
  });
});

// Rota para enviar mensagens
app.post('/enviar-mensagens', async (req, res) => {
  try {
    const { clientes, mensagem } = req.body;
    
    if (!clientes || !Array.isArray(clientes)) {
      return res.status(400).json({ success: false, message: 'Lista de clientes inválida' });
    }
    
    if (!mensagem || typeof mensagem !== 'string') {
      return res.status(400).json({ success: false, message: 'Mensagem inválida' });
    }

    let enviados = 0;
    const erros = [];
    
    // Enviar mensagem para cada cliente
    for (const cliente of clientes) {
      try {
        // Substituir placeholders na mensagem
        let mensagemPersonalizada = mensagem
          .replace(/{nome}/g, cliente.nome || '')
          .replace(/{fatura}/g, cliente.valor_fatura || '')
          .replace(/{data}/g, cliente.data_vencimento || '')
          .replace(/{cpf}/g, cliente.cpf || '');

        // Enviar mensagem via API GZAPPY
        const response = await fetch('https://v2-api.gzappy.com/message/send-text', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone: cliente.telefone,
            message: mensagemPersonalizada
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Erro ao enviar mensagem');
        }

        enviados++;
      } catch (error) {
        erros.push({
          cliente: cliente.nome || 'Cliente sem nome',
          telefone: cliente.telefone,
          erro: error.message
        });
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
    console.error('Erro no servidor:', error);
    res.status(500).json({ success: false, message: 'Erro interno no servidor' });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});