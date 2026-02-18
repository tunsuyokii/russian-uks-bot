(function () {
  'use strict';

  const PROXY_API_BASE = 'https://api.proxyapi.ru/openai/v1';
  const PROXY_API_TOKEN = 'sk-p9GFcLAe2fffyG3mW2xXg35SXyuG1rzA';

  const VISION_MODEL = 'gpt-4o';
  const VERIFY_MODEL = 'gpt-5.2';

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const previewWrap = document.getElementById('preview-wrap');
  const preview = document.getElementById('preview');
  const clearBtn = document.getElementById('clear-btn');
  const submitBtn = document.getElementById('submit-btn');
  const resultPlaceholder = document.getElementById('result-placeholder');
  const resultContent = document.getElementById('result-content');
  const answerText = document.getElementById('answer-text');
  const explanationText = document.getElementById('explanation-text');
  const resultError = document.getElementById('result-error');
  const loading = document.getElementById('loading');

  let currentImageDataUrl = null;

  function showPreview(dataUrl) {
    currentImageDataUrl = dataUrl;
    preview.src = dataUrl;
    previewWrap.classList.remove('hidden');
    dropZone.classList.add('hidden');
    submitBtn.classList.remove('hidden');
    submitBtn.disabled = false;
    hideResult();
  }

  function clearImage() {
    currentImageDataUrl = null;
    fileInput.value = '';
    preview.src = '';
    previewWrap.classList.add('hidden');
    dropZone.classList.remove('hidden');
    submitBtn.classList.add('hidden');
    submitBtn.disabled = true;
    hideResult();
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

  async function analyzeImage(dataUrl) {
    const base64 = getBase64FromDataUrl(dataUrl);
    const mime = getMimeType(dataUrl);

    const visionPrompt = [
      'Ты эксперт по русскому языку. По изображению видишь задание (упражнение, вопрос, тест).',
      'Сделай два блока:',
      '1) Ответ: точный ответ на задание (слово, буквы, предложение или номер варианта — как требуется).',
      '2) Пояснение: кратко объясни правило или ход решения.'
    ].join('\n');

    const visionBody = {
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: visionPrompt },
            {
              type: 'image_url',
              image_url: {
                url: 'data:' + mime + ';base64,' + base64
              }
            }
          ]
        }
      ],
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
      'Верни в том же формате: Ответ: ... Пояснение: ... Если всё верно — оставь как есть, иначе дай исправленный вариант.'
    ].join('\n');

    let verifyContent = rawContent;
    const verifyBody = {
      model: VERIFY_MODEL,
      messages: [{ role: 'user', content: verifyPrompt }],
      max_tokens: 1024
    };
    try {
      const verifyRes = await proxyChat(verifyBody);
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
    if (!currentImageDataUrl) return;
    setLoading(true);
    try {
      const { answer, explanation } = await analyzeImage(currentImageDataUrl);
      showResult(answer, explanation);
    } catch (e) {
      showError('Ошибка: ' + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function () {
      showPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }

  dropZone.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    const file = fileInput.files && fileInput.files[0];
    handleFile(file);
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
    handleFile(file);
  });

  document.addEventListener('paste', function (e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        handleFile(items[i].getAsFile());
        return;
      }
    }
  });

  clearBtn.addEventListener('click', clearImage);
  submitBtn.addEventListener('click', onSubmit);
})();
