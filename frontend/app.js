/*
*============================================================
* Cliente WebSocket para el chat en tiempo real
* Maneja toda la lógica del frontend y comunicación con el servidor
*/

class ChatClient {
  constructor() {
    // WebSocket
    this.socket               = null;
    this.reconnectAttempts    = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay       = 3000;

    // Estado del cliente
    this.username    = null;
    this.clientId    = null;
    this.isConnected = false;

    // Configuración del servidor WebSocket
    this.conProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.conHost     = 'localhost';
    this.conPort     = '8060';

    // Elementos DOM
    this.elements = {
      // Modal
      welcomeModal: document.getElementById('welcomeModal'),
      usernameForm: document.getElementById('usernameForm'),
      usernameInput: document.getElementById('usernameInput'),

      // Messages
      messagesContainer: document.getElementById('messagesContainer'),
      messageForm: document.getElementById('messageForm'),
      messageInput: document.getElementById('messageInput'),
      sendButton: document.getElementById('sendButton'),
      charCount: document.getElementById('charCount'),
      rateLimitInfo: document.getElementById('rateLimitInfo'),

      // Users
      usersList: document.getElementById('usersList'),
      userCount: document.getElementById('userCount'),

      // Status
      statusIndicator: document.getElementById('statusIndicator'),
      statusText: document.getElementById('statusText'),

      // Toast
      toastContainer: document.getElementById('toastContainer')
    };

    this.init();
  }

  /*
  *============================================================
  * Inicializa la aplicación
  */
  init() {
    this.setupEventListeners();
    this.connect();
  }

  /*
  *============================================================
  * Configura los event listeners
  */
  setupEventListeners() {
    // Formulario de username
    this.elements.usernameForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.joinChat();
    });

    // Formulario de mensaje
    this.elements.messageForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendMessage();
    });

    // Contador de caracteres
    this.elements.messageInput.addEventListener('input', (e) => {
      const length                        = e.target.value.length;
      this.elements.charCount.textContent = `${length}/500`;
    });

    // Reconexión al recuperar visibilidad
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !this.isConnected) {
        this.connect();
      }
    });
  }

  /*
  *============================================================
  * Conecta al servidor WebSocket
  */
  connect() {
    try {
      // Determinar URL del WebSocket
      const wsUrl    = `${this.conProtocol}//${this.conHost}:${this.conPort}`;

      console.log(`Conectando a ${wsUrl}...`);
      this.socket = new WebSocket(wsUrl);

      this.setupSocketEvents();
    } catch (error) {
      console.error('Error al conectar:', error);
      this.showToast('Error al conectar con el servidor', 'error');
      this.scheduleReconnect();
    }
  }

  /*
  *============================================================
  * Configura eventos del WebSocket
  */
  setupSocketEvents() {
    this.socket.onopen = () => {
      console.log('Conexión WebSocket establecida');
      this.isConnected       = true;
      this.reconnectAttempts = 0;
      this.updateConnectionStatus(true);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Error parseando mensaje:', error);
      }
    };

    this.socket.onerror = (error) => {
      console.error('Error en WebSocket:', error);
      this.showToast('Error de conexión', 'error');
    };

    this.socket.onclose = (event) => {
      console.log('Conexión WebSocket cerrada', event.code, event.reason);
      this.isConnected = false;
      this.updateConnectionStatus(false);

      if (event.code !== 1000) { // No fue un cierre normal
        this.showToast('Conexión perdida. Intentando reconectar...', 'warning');
        this.scheduleReconnect();
      }
    };
  }

  /*
  *============================================================
  * Maneja mensajes del servidor
  */
  handleMessage(data) {
    console.log('Mensaje recibido:', data);

    switch (data.type) {
      case 'connection':
        this.clientId = data.clientId;
        console.log('Cliente ID:', this.clientId);
        break;

      case 'joined':
        this.username = data.username;
        this.hideWelcomeModal();
        this.enableChat();
        this.updateUsersList(data.users);
        this.showToast(`Bienvenido, ${this.username}!`, 'success');
        break;

      case 'message':
        this.renderMessage(data);
        break;

      case 'userJoined':
        this.renderSystemMessage(`${data.username} se ha unido al chat`);
        this.updateUsersList(data.users);
        break;

      case 'userLeft':
        this.renderSystemMessage(`${data.username} ha abandonado el chat`);
        this.updateUsersList(data.users);
        break;

      case 'error':
        this.showToast(data.message, 'error');
        break;

      case 'pong':
        // Respuesta al ping (keepalive)
        break;

      default:
        console.warn('Tipo de mensaje desconocido:', data.type);
    }
  }

  /*
  *============================================================
  * Unirse al chat con nombre de usuario
  */
  joinChat() {
    const username = this.elements.usernameInput.value.trim();

    if (username.length < 2) {
      this.showToast('El nombre debe tener al menos 2 caracteres', 'error');
      return;
    }

    if (username.length > 30) {
      this.showToast('El nombre no puede exceder 30 caracteres', 'error');
      return;
    }

    if (!this.isConnected) {
      this.showToast('No hay conexión con el servidor', 'error');
      return;
    }

    this.send({
      type: 'join',
      username: username
    });
  }

  /*
  *============================================================
  * Envía un mensaje al chat
  */
  sendMessage() {
    const content = this.elements.messageInput.value.trim();

    if (!content) {
      return;
    }

    if (!this.isConnected) {
      this.showToast('No hay conexión con el servidor', 'error');
      return;
    }

    if (!this.username) {
      this.showToast('Debes unirte al chat primero', 'error');
      return;
    }

    this.send({
      type: 'message',
      content: content
    });

    // Limpiar input
    this.elements.messageInput.value = '';
    this.elements.charCount.textContent = '0/500';
    this.elements.messageInput.focus();
  }

  /*
  *============================================================
  * Envía datos al servidor
  */
  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(data));
      } catch (error) {
        console.error('Error enviando mensaje:', error);
        this.showToast('Error al enviar mensaje', 'error');
      }
    } else {
      this.showToast('No conectado al servidor', 'error');
    }
  }

  /*
  *============================================================
  * Renderiza un mensaje en el chat
  */
  renderMessage(data) {
    // Se crea elemento
    const messageDiv     = document.createElement('div');
    const avatar         = document.createElement('div');
    const contentDiv     = document.createElement('div');
    const header         = document.createElement('div');
    const usernameSpan   = document.createElement('span');
    const timeSpan       = document.createElement('span');
    const textDiv        = document.createElement('div');

    // Se agrega contenido al elemento
    messageDiv.className     = `message ${data.username === this.username ? 'own' : ''}`;
    avatar.className         = 'message-avatar';
    avatar.textContent       = data.username.charAt(0).toUpperCase();
    contentDiv.className     = 'message-content';
    header.className         = 'message-header';
    usernameSpan.className   = 'message-username';
    usernameSpan.textContent = data.username;
    timeSpan.className       = 'message-time';
    timeSpan.textContent     = this.formatTime(data.timestamp);
    textDiv.className        = 'message-text';
    textDiv.textContent      = data.content;

    // Se integran datos
    header.appendChild(usernameSpan);
    header.appendChild(timeSpan);
    contentDiv.appendChild(header);
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    // Remover mensaje de bienvenida si existe
    const welcomeMessage = this.elements.messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }

    this.elements.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  /*
  *============================================================
  * Renderiza un mensaje del sistema
  */
  renderSystemMessage(text) {
    const messageDiv        = document.createElement('div');
    messageDiv.className    = 'system-message';
    messageDiv.textContent  = text;

    this.elements.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  /*
  *============================================================
  * Actualiza la lista de usuarios
  */
  updateUsersList(users) {
    this.elements.userCount.textContent = users.length;

    if (users.length === 0) {
      this.elements.usersList.innerHTML = '<p class="no-users">No hay usuarios conectados</p>';
      return;
    }

    this.elements.usersList.innerHTML = '';

    users.forEach(user => {
      // Se crea elemento
      const userItem   = document.createElement('div');
      const avatar     = document.createElement('div');
      const userInfo   = document.createElement('div');
      const userName   = document.createElement('div');
      const userStatus = document.createElement('div');

      // Se agrega contenido al elemento
      userItem.className     = 'user-item';
      avatar.className       = 'user-avatar';
      avatar.textContent     = user.username.charAt(0).toUpperCase();
      userInfo.className     = 'user-info';
      userName.className     = 'user-name';
      userName.textContent   = user.username;
      userStatus.className   = 'user-status';
      userStatus.textContent = 'Activo';

      // Se integran datos
      userInfo.appendChild(userName);
      userInfo.appendChild(userStatus);
      userItem.appendChild(avatar);
      userItem.appendChild(userInfo);

      this.elements.usersList.appendChild(userItem);
    });
  }

  /*
  *============================================================
  * Actualiza el estado de conexión
  */
  updateConnectionStatus(connected) {
    if (connected) {
      this.elements.statusIndicator.classList.add('connected');
      this.elements.statusText.textContent = 'Conectado';
    } else {
      this.elements.statusIndicator.classList.remove('connected');
      this.elements.statusText.textContent = 'Desconectado';
    }
  }

  /*
  *============================================================
  * Habilita el chat después de unirse
  */
  enableChat() {
    this.elements.messageInput.disabled = false;
    this.elements.sendButton.disabled   = false;
    this.elements.messageInput.focus();
  }

  /*
  *============================================================
  * Muestra el modal de bienvenida
  */
  showWelcomeModal() {
    this.elements.welcomeModal.classList.remove('hidden');
    this.elements.usernameInput.focus();
  }

  /*
  *============================================================
  * Oculta el modal de bienvenida
  */
  hideWelcomeModal() {
    this.elements.welcomeModal.classList.add('hidden');
  }

  /*
  *============================================================
  * Muestra una notificación toast
  */
  showToast(message, type = 'info') {
    const toast     = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon     = document.createElement('span');
    icon.className = 'toast-icon';

    // Tipo de notificacion
    switch (type) {
      case 'success': icon.textContent = '✓'; break;
      case 'error':   icon.textContent = '✕'; break;
      case 'warning': icon.textContent = '⚠'; break;
      default: icon.textContent = 'ℹ';
    }

    const messageSpan       = document.createElement('span');
    messageSpan.className   = 'toast-message';
    messageSpan.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(messageSpan);

    this.elements.toastContainer.appendChild(toast);

    // Auto-remover después de 5 segundos
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  /*
  *============================================================
  * Programa un intento de reconexión
  */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showToast('No se pudo reconectar. Recarga la página.', 'error');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Intento de reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, this.reconnectDelay);
  }

  /*
  *============================================================
  * Scroll automático al último mensaje
  */
  scrollToBottom() {
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
  }

  /*
  *============================================================
  * Formatea un timestamp
  */
  formatTime(timestamp) {
    const date    = new Date(timestamp);
    const hours   = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.chatClient = new ChatClient();
});