/*
*============================================================
* Configuración centralizada del servidor de chat
* Todas las constantes y configuraciones del sistema
*/

const config = {
  // Configuración del servidor
  PORT: process.env.PORT || 8060,  // 8080 por defecto
  HOST: process.env.HOST || 'localhost',

  // Configuración de WebSocket
  WS_PATH: '/',

  // Rate Limiting
  MAX_MESSAGES_PER_MINUTE: 10,
  RATE_LIMIT_WINDOW: 60000, // 60 segundos en milisegundos

  // Mensajes
  MESSAGE_DELAY: 100, // Delay artificial entre mensajes (ms)
  MAX_MESSAGE_LENGTH: 500,
  MIN_MESSAGE_LENGTH: 1,

  // Usuarios
  MAX_USERNAME_LENGTH: 30,
  MIN_USERNAME_LENGTH: 2,

  // Logging
  LOG_DIRECTORY: './logs',
  LOG_INFO: 'info.log',
  LOG_WARNINGS: 'warnings.log',
  LOG_ERRORS: 'errors.log',
  LOG_CONVERSATIONS: 'conversations.log',

  // Timeouts
  CONNECTION_TIMEOUT: 30000, // 30 segundos
  PING_INTERVAL: 30000, // 30 segundos
  PONG_TIMEOUT: 5000, // 5 segundos

  // Mensajes del sistema
  MESSAGES: {
    WELCOME: 'Bienvenido al chat en tiempo real',
    CONNECTION_SUCCESS: 'Conectado al servidor',
    USER_JOINED: 'se ha unido al chat',
    USER_LEFT: 'ha abandonado el chat',
    RATE_LIMIT_EXCEEDED: 'Has superado el límite de mensajes. Espera un momento.',
    MESSAGE_TOO_LONG: 'El mensaje es demasiado largo',
    MESSAGE_TOO_SHORT: 'El mensaje es demasiado corto',
    INVALID_USERNAME: 'Nombre de usuario inválido',
    USERNAME_TAKEN: 'Este nombre de usuario ya está en uso',
    INVALID_MESSAGE_FORMAT: 'Formato de mensaje inválido',
    SERVER_ERROR: 'Error del servidor. Intenta nuevamente.'
  }
};

module.exports = config;
