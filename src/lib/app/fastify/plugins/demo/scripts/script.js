(function() {
  const selector = document.getElementById('selector');
  const chat = document.getElementById('chat');
  const modelSelect = document.getElementById('modelSelect');
  const startButton = document.getElementById('startButton');
  const messagesContainer = document.getElementById('messages');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const viewReportButton = document.getElementById('viewReportButton');
  const reportModal = document.getElementById('reportModal');
  const modalClose = document.getElementById('modalClose');
  const reportJson = document.getElementById('reportJson');

  // Get externalId from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const externalId = urlParams.get('externalId');
  let sessionId = null;
  let isCompleted = false;

  // Show selector if no externalId, otherwise show chat
  if (!externalId) {
    selector.style.display = 'flex';
    chat.style.display = 'none';
  } else {
    selector.style.display = 'none';
    chat.style.display = 'flex';
  }

  // Handle model selection
  startButton.addEventListener('click', function() {
    const selectedModel = modelSelect.value;
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('externalId', selectedModel);
    window.location.href = newUrl.toString();
  });

  // Only initialize chat if externalId is present
  if (!externalId) {
    return;
  }

  function addMessage(text, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat__message';
    messageDiv.classList.add(isUser ? 'chat__message--user' : 'chat__message--system');
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function setInputEnabled(enabled) {
    messageInput.disabled = !enabled;
    sendButton.disabled = !enabled;
    if (enabled) {
      messageInput.focus();
      // Reset height when re-enabled
      adjustTextareaHeight();
    }
  }

  async function initializeSession() {
    try {
      setInputEnabled(false);
      addMessage('Initializing...', false);

      const response = await fetch(`/s/${externalId}/init`, {
        method: 'POST',
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }
        throw new Error(errorData.message || 'Failed to initialize session');
      }

      const data = await response.json();
      sessionId = data.sessionId;

      // Remove the "Initializing..." message
      messagesContainer.removeChild(messagesContainer.lastChild);

      if (data.question) {
        addMessage(data.question, false);
        setInputEnabled(true);
      } else if (data.message) {
        addMessage(data.message, false);
        setInputEnabled(false);
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
      messagesContainer.removeChild(messagesContainer.lastChild);
      addMessage('Failed to start the survey. Please try again later.', false);
      setInputEnabled(false);
    }
  }

  async function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '' || isCompleted || !sessionId) {
      return;
    }

    addMessage(text, true);
    messageInput.value = '';
    // Reset textarea height after clearing
    messageInput.style.height = 'auto';
    adjustTextareaHeight();
    setInputEnabled(false);

    try {
      const response = await fetch(`/s/${externalId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          answerText: text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send response');
      }

      const data = await response.json();

      if (data.completed) {
        isCompleted = true;
        addMessage(data.message, false);
        setInputEnabled(false);
        viewReportButton.style.display = 'block';
      } else if (data.message) {
        addMessage(data.message, false);
        if (data.sessionId) {
          sessionId = data.sessionId;
        }
        setInputEnabled(true);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      addMessage('Failed to send your response. Please try again.', false);
      setInputEnabled(true);
    }
  }

  // Autogrow functionality
  function adjustTextareaHeight() {
    const textarea = messageInput;
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Calculate new height based on content
    const newHeight = Math.min(textarea.scrollHeight, 200); // Max height of 200px
    textarea.style.height = newHeight + 'px';
  }

  // Adjust height on input
  messageInput.addEventListener('input', adjustTextareaHeight);

  // Handle Enter and Shift+Enter
  messageInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !messageInput.disabled) {
      if (event.shiftKey) {
        // Shift+Enter: allow new line (default behavior)
        // Height will adjust automatically via input event
        return;
      } else {
        // Enter alone: send message
        event.preventDefault();
        sendMessage();
      }
    }
  });

  sendButton.addEventListener('click', sendMessage);

  async function viewReport() {
    if (!sessionId) {
      return;
    }

    try {
      const response = await fetch(`/demo/report/${sessionId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch report');
      }

      const data = await response.json();
      const formattedJson = JSON.stringify(data.report, null, 2);
      reportJson.textContent = formattedJson;
      reportModal.classList.add('modal--open');
    } catch (error) {
      console.error('Failed to fetch report:', error);
      alert('Failed to load report. Please try again.');
    }
  }

  function closeModal() {
    reportModal.classList.remove('modal--open');
  }

  viewReportButton.addEventListener('click', viewReport);
  modalClose.addEventListener('click', closeModal);

  reportModal.addEventListener('click', function(event) {
    if (event.target === reportModal || event.target.classList.contains('modal__overlay')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && reportModal.classList.contains('modal--open')) {
      closeModal();
    }
  });

  // Initialize session when page loads (only if externalId is present)
  if (externalId) {
    initializeSession();
  }
})();
