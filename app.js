(function () {
  'use strict';

  const PROXY_API_BASE = 'https://api.proxyapi.ru/openai/v1';
  const PROXY_API_TOKEN = 'sk-p9GFcLAe2fffyG3mW2xXg35SXyuG1rzA';

  const VISION_MODEL = 'gpt-4o';
  const VERIFY_MODEL = 'gpt-5.2';

  const contextDropZone = document.getElementById('context-drop-zone');
  const contextFileInput = document.getElementById('context-file-input');
  const contextPreviewWrap = document.getElementById('context-preview-wrap');
  const contextPreview = document.getElementById('context-preview');
  const contextClearBtn = document.getElementById('context-clear-btn');
  const questionDropZone = document.getElementById('question-drop-zone');
  const questionFileInput = document.getElementById('question-file-input');
  const questionPreviewWrap = document.getElementById('question-preview-wrap');
  const questionPreview = document.getElementById('question-preview');
  const questionClearBtn = document.getElementById('question-clear-btn');
  const submitBtn = document.getElementById('submit-btn');
  const resultPlaceholder = document.getElementById('result-placeholder');
  const resultContent = document.getElementById('result-content');
  const answerText = document.getElementById('answer-text');
  const explanationText = document.getElementById('explanation-text');
  const resultError = document.getElementById('result-error');
  const loading = document.getElementById('loading');

  let contextImageDataUrl = null;
  let questionImageDataUrl = null;
  let lastPasteTarget = 'context';

  function updateSubmitButton() {
    submitBtn.disabled = !(contextImageDataUrl && questionImageDataUrl);
  }

  function setImage(slot, dataUrl) {
    if (slot === 'context') {
      contextImageDataUrl = dataUrl;
      contextPreview.src = dataUrl;
      contextPreviewWrap.classList.remove('hidden');
      contextDropZone.classList.add('hidden');
    } else {
      questionImageDataUrl = dataUrl;
      questionPreview.src = dataUrl;
      questionPreviewWrap.classList.remove('hidden');
      questionDropZone.classList.add('hidden');
    }
    hideResult();
    updateSubmitButton();
  }

  function clearImage(slot) {
    if (slot === 'context') {
      contextImageDataUrl = null;
      contextFileInput.value = '';
      contextPreview.src = '';
      contextPreviewWrap.classList.add('hidden');
      contextDropZone.classList.remove('hidden');
    } else {
      questionImageDataUrl = null;
      questionFileInput.value = '';
      questionPreview.src = '';
      questionPreviewWrap.classList.add('hidden');
      questionDropZone.classList.remove('hidden');
    }
    hideResult();
    updateSubmitButton();
  }

  function hideResult() {
    resultPlaceholder.classList.remove('hidden');
    resultContent.classList.add('hidden');
    resultError.classList.add('hidden');
    loading.classList.add('hidden');
  }

  function showResult(answer, explanation) {
    resultPlaceholder.classList.add('hidden');
    resultError.classList.add('hidden');
    answerText.textContent = answer || '—';
    explanationText.textContent = explanation || '—';
    resultContent.classList.remove('hidden');
  }

  function showError(msg) {
    resultPlaceholder.classList.add('hidden');
    resultContent.classList.add('hidden');
    resultError.textContent = msg;
    resultError.classList.remove('hidden');
  }

  function setLoading(on) {
    if (on) {
      resultPlaceholder.classList.add('hidden');
      resultContent.classList.add('hidden');
      resultError.classList.add('hidden');
      loading.classList.remove('hidden');
    } else {
      loading.classList.add('hidden');
    }
  }

  function getBase64FromDataUrl(dataUrl) {
    const i = dataUrl.indexOf(',');
    return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  }

  function getMimeType(dataUrl) {
    const match = dataUrl.match(/^data:([^;]+);/);
    return (match && match[1]) || 'image/png';
  }

  async function proxyChat(body) {
    const res = await fetch(PROXY_API_BASE + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + PROXY_API_TOKEN
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(res.status + ': ' + err);
    }
    return res.json();
  }

  function parseAnswerAndExplanation(text) {
    let answer = '';
    let explanation = '';
    const lower = (text || '').toLowerCase();
    const answerIdx = lower.indexOf('ответ:');
    const explIdx = lower.indexOf('пояснение:');
    if (answerIdx >= 0 && explIdx >= 0) {
      answer = text.slice(answerIdx + 6, explIdx).trim();
      explanation = text.slice(explIdx + 11).trim();
    } else if (answerIdx >= 0) {
      answer = text.slice(answerIdx + 6).trim();
      explanation = text.slice(0, answerIdx).trim() || text;
    } else {
      answer = text.trim();
    }
    return { answer, explanation };
  }

  async function analyzeWithTwoImages(contextDataUrl, questionDataUrl) {
    const prompt = [
      'Ты эксперт по русскому языку. На двух изображениях:',
      '1) Первое изображение — контекст (текст, отрывок, правило, по которому составлен вопрос).',
      '2) Второе изображение — формулировка вопроса или задания.',
      'Дай ответ на вопрос по контексту. Сделай два блока:',
      '1) Ответ: точный ответ (слово, буквы, предложение или номер варианта — как требуется).',
      '2) Пояснение: кратко объясни правило или ход решения.'
    ].join('\n');

    const content = [
      { type: 'text', text: prompt },
      {
        type: 'image_url',
        image_url: {
          url: contextDataUrl.indexOf('data:') === 0 ? contextDataUrl : 'data:image/png;base64,' + contextDataUrl
        }
      },
      {
        type: 'image_url',
        image_url: {
          url: questionDataUrl.indexOf('data:') === 0 ? questionDataUrl : 'data:image/png;base64,' + questionDataUrl
        }
      }
    ];

    const contextBase64 = contextDataUrl.indexOf('data:') === 0 ? getBase64FromDataUrl(contextDataUrl) : contextDataUrl;
    const contextMime = contextDataUrl.indexOf('data:') === 0 ? getMimeType(contextDataUrl) : 'image/png';
    const questionBase64 = questionDataUrl.indexOf('data:') === 0 ? getBase64FromDataUrl(questionDataUrl) : questionDataUrl;
    const questionMime = questionDataUrl.indexOf('data:') === 0 ? getMimeType(questionDataUrl) : 'image/png';

    content[1].image_url.url = 'data:' + contextMime + ';base64,' + contextBase64;
    content[2].image_url.url = 'data:' + questionMime + ';base64,' + questionBase64;

    const visionBody = {
      model: VISION_MODEL,
      messages: [{ role: 'user', content: content }],
      max_tokens: 1024
    };

    const visionRes = await proxyChat(visionBody);
    const rawContent = visionRes.choices && visionRes.choices[0] && visionRes.choices[0].message
      ? visionRes.choices[0].message.content
      : '';

    const { answer, explanation } = parseAnswerAndExplanation(rawContent);

    const verifyPrompt = [
      'Проверь и при необходимости исправь ответ по русскому языку.',
      'Ответ: ' + answer,
      'Пояснение: ' + explanation,
      'Верни в том же формате: Ответ: ... Пояснение: ...'
    ].join('\n');

    let verifyContent = rawContent;
    try {
      const verifyRes = await proxyChat({
        model: VERIFY_MODEL,
        messages: [{ role: 'user', content: verifyPrompt }],
        max_tokens: 1024
      });
      verifyContent = verifyRes.choices && verifyRes.choices[0] && verifyRes.choices[0].message
        ? verifyRes.choices[0].message.content
        : rawContent;
    } catch (_) {
      try {
        const fallbackRes = await proxyChat({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: verifyPrompt }],
          max_tokens: 1024
        });
        verifyContent = fallbackRes.choices && fallbackRes.choices[0] && fallbackRes.choices[0].message
          ? fallbackRes.choices[0].message.content
          : rawContent;
      } catch (__) {}
    }
    return parseAnswerAndExplanation(verifyContent);
  }

  async function onSubmit() {
    if (!contextImageDataUrl || !questionImageDataUrl) return;
    setLoading(true);
    try {
      const { answer, explanation } = await analyzeWithTwoImages(contextImageDataUrl, questionImageDataUrl);
      showResult(answer, explanation);
    } catch (e) {
      showError('Ошибка: ' + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  function handleFile(slot, file) {
    if (!file || typeof file !== 'object') return;
    var isImage = file.type && (file.type.startsWith('image/') || file.type.indexOf('image') !== -1);
    if (!isImage && file.type && file.type !== '') return;
    const reader = new FileReader();
    reader.onload = function () {
      if (reader.result && typeof reader.result === 'string') {
        setImage(slot, reader.result);
      }
    };
    reader.onerror = function () {
      showError('Не удалось прочитать файл.');
    };
    reader.readAsDataURL(file);
  }

  function setupSlot(slot, dropZone, fileInput, clearBtn) {
    dropZone.addEventListener('click', function () {
      lastPasteTarget = slot;
    });
    fileInput.addEventListener('change', function () {
      const file = fileInput.files && fileInput.files[0];
      handleFile(slot, file);
    });
    clearBtn.addEventListener('click', function () {
      clearImage(slot);
    });
    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', function () {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      handleFile(slot, file);
    });
  }

  setupSlot('context', contextDropZone, contextFileInput, contextClearBtn);
  setupSlot('question', questionDropZone, questionFileInput, questionClearBtn);

  document.addEventListener('paste', function (e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) return;
        if (lastPasteTarget === 'context' && !contextImageDataUrl) {
          handleFile('context', file);
        } else if (lastPasteTarget === 'question' && !questionImageDataUrl) {
          handleFile('question', file);
        } else if (!contextImageDataUrl) {
          handleFile('context', file);
        } else {
          handleFile('question', file);
        }
        return;
      }
    }
  });

  document.querySelector('label[for="context-file-input"]').addEventListener('click', function () { lastPasteTarget = 'context'; });
  document.querySelector('label[for="question-file-input"]').addEventListener('click', function () { lastPasteTarget = 'question'; });
  contextPreviewWrap.addEventListener('click', function () { lastPasteTarget = 'context'; });
  questionPreviewWrap.addEventListener('click', function () { lastPasteTarget = 'question'; });

  submitBtn.addEventListener('click', onSubmit);
})();
