const GUIDED_STEPS = [
  { key: 'warmup_01', text: '今日は日本語の発音を練習します。ゆっくり、はっきり、最後まで話します。', phone: null, error: 'baseline', variant: 'standard', hint: 'Làm quen với micro. Đọc tự nhiên, rõ chữ; không cần cố tạo lỗi.' },
  { key: 'warmup_02', text: '朝、私は駅の近くの店で、温かいコーヒーを買いました。', phone: null, error: 'baseline', variant: 'standard', hint: 'Đọc liền mạch như đang kể một việc vừa xảy ra.' },
  { key: 'tsu_01', text: '私はつくえを使って、次の週末の予定を書きます。', phone: 'ts', error: 'tsu_to_chu', variant: 'standard', hint: 'Đọc chuẩn. Giữ つ là tsu, không đọc thành chu.' },
  { key: 'tsu_02_intentional', text: '私はつくえを使って、次の週末の予定を書きます。', phone: 'ts', error: 'tsu_to_chu', variant: 'intentional_error', hint: 'Bản có kiểm soát: chỉ lần này, đọc つ gần âm “chu” để tạo ví dụ lỗi.' },
  { key: 'tsu_03', text: '次の月曜日に、父と一緒に小さな図書館へ行きました。', phone: 'ts', error: 'tsu_to_chu', variant: 'standard', hint: 'Trở lại đọc chuẩn và tự nhiên.' },
  { key: 'tsu_04', text: 'いつも使っているかばんに、二つの本を入れました。', phone: 'ts', error: 'tsu_to_chu', variant: 'standard', hint: 'Đọc trơn tru cả câu, không tách từng từ.' },
  { key: 'sokuon_01', text: '昨日、私は切手を買って、友達に手紙を書きました。', phone: 'cl', error: 'sokuon', variant: 'standard', hint: 'Đọc chuẩn. Có khoảng ngắt rất ngắn ở っ, rồi mới sang âm kế tiếp.' },
  { key: 'sokuon_02_intentional', text: '昨日、私は切手を買って、友達に手紙を書きました。', phone: 'cl', error: 'sokuon', variant: 'intentional_error', hint: 'Bản có kiểm soát: chỉ lần này, cố tình bỏ khoảng ngắt của っ.' },
  { key: 'sokuon_03', text: '学校の近くにある小さな店で、ゆっくり待っていました。', phone: 'cl', error: 'sokuon', variant: 'standard', hint: 'Trở lại đọc chuẩn; giữ nhịp đều, không nuốt âm ngắt.' },
  { key: 'sokuon_04', text: '朝、家を出る前に、ちょっとだけ音楽を聞きました。', phone: 'cl', error: 'sokuon', variant: 'standard', hint: 'Đọc như hội thoại bình thường, không cần cố đọc chậm.' },
  { key: 'long_01', text: '午後、私はケーキとコーヒーをゆっくり食べました。', phone: 'e', error: 'long_vowel', variant: 'standard', hint: 'Đọc chuẩn. Kéo ー trong ケーキ đủ rõ, nhưng đừng kéo quá mức.' },
  { key: 'long_02_intentional', text: '午後、私はケーキとコーヒーをゆっくり食べました。', phone: 'e', error: 'long_vowel', variant: 'intentional_error', hint: 'Bản có kiểm soát: chỉ lần này, đọc ケーキ ngắn trường âm.' },
  { key: 'long_03', text: '先生と一緒に、駅の近くのケーキ屋さんへ行きました。', phone: 'e', error: 'long_vowel', variant: 'standard', hint: 'Trở lại đọc chuẩn, giữ tốc độ nói tự nhiên.' },
  { key: 'long_04', text: '旅行のあとで、弟とゲームをして遊びました。', phone: 'e', error: 'long_vowel', variant: 'standard', hint: 'Đọc liền mạch toàn câu và chú ý các nguyên âm dài.' },
  { key: 'mora_n_01', text: '新聞を読んでから、銀行へ行きました。', phone: 'N', error: 'mora_n', variant: 'standard', hint: 'Đọc chuẩn. Giữ mora ん rõ ràng, không nuốt vào âm kế tiếp.' },
  { key: 'mora_n_02_intentional', text: '新聞を読んでから、銀行へ行きました。', phone: 'N', error: 'mora_n', variant: 'intentional_error', hint: 'Bản có kiểm soát: chỉ lần này, cố tình làm ん mờ hoặc nuốt đi.' },
  { key: 'mora_n_03', text: '今晩、家族と一緒にご飯を食べます。', phone: 'N', error: 'mora_n', variant: 'standard', hint: 'Trở lại đọc chuẩn, giữ nhịp mora đều.' },
  { key: 'mora_n_04', text: '天気がいいので、友人と公園を散歩しました。', phone: 'N', error: 'mora_n', variant: 'standard', hint: 'Đọc tự nhiên và không tách câu thành từng mora.' },
  { key: 'mixed_01', text: '今朝、駅で切手を買い、電車の中で新聞を読みました。', phone: null, error: 'mixed', variant: 'standard', hint: 'Câu tổng hợp: ưu tiên sự tự nhiên, nhịp và các âm đã luyện.' },
  { key: 'closing_01', text: '私は日本語を勉強しています。これからも毎日少しずつ練習したいです。', phone: null, error: 'mixed', variant: 'standard', hint: 'Câu kết. Đọc như tự giới thiệu, mạch lạc và tự nhiên.' },
]

let mode = 'guided', recording = null, recordingUrl = null, recorder = null, startedAt = 0, recordingMs = 0, reviewKey = '', reviewItems = [], selectedAttempt = null, reviewAudioUrl = null
let sessionId = '', sessionIndex = 0
const SESSION_STORAGE_KEY = 'kotodama-guided-session-v1'
const $ = (id) => document.getElementById(id)
const message = (id, value, ok = false) => { const node = $(id); node.textContent = value; node.style.color = ok ? '#8ee0bb' : '#f5b1c9' }

function makeSessionId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (letter) => {
    const value = Math.floor(Math.random() * 16)
    return (letter === 'x' ? value : (value & 3) | 8).toString(16)
  })
}
function restoreSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || '{}')
    if (/^[0-9a-f-]{36}$/i.test(saved.sessionId) && Number.isInteger(saved.sessionIndex) && saved.sessionIndex >= 0 && saved.sessionIndex <= GUIDED_STEPS.length) {
      sessionId = saved.sessionId; sessionIndex = saved.sessionIndex; return
    }
  } catch {}
  sessionId = makeSessionId(); sessionIndex = 0
}
function saveSession() { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ sessionId, sessionIndex })) }
function restartSession() { sessionId = makeSessionId(); sessionIndex = 0; saveSession(); resetRecording(); renderPrompt(); message('message', 'Đã tạo phiên mới từ câu đầu tiên.', true) }
function guidedStep() { return GUIDED_STEPS[sessionIndex] || null }
function promptText() { const step = guidedStep(); return mode === 'guided' ? step?.text || '' : $('free-text').value.trim() }
function resetRecording() {
  if (recordingUrl) URL.revokeObjectURL(recordingUrl)
  recording = null; recordingUrl = null; recordingMs = 0
  $('preview').hidden = true; $('preview').removeAttribute('src'); $('redo').hidden = true
  $('submit').disabled = true; $('recorder-state').textContent = 'Sẵn sàng ghi câu này.'
}
function renderPrompt() {
  const step = guidedStep()
  const guided = mode === 'guided'
  $('guided-fields').hidden = !guided; $('free-fields').hidden = guided
  $('prompt-caption').textContent = guided ? (step ? 'Bước ' + (sessionIndex + 1) + ' · đọc câu này' : 'Phiên thu đã hoàn thành') : 'Đọc câu này'
  $('prompt-text').textContent = guided ? (step?.text || 'Cảm ơn bạn đã hoàn thành phiên thu.') : (promptText() || 'Nhập câu tiếng Nhật trước.')
  $('submit').textContent = guided ? (step ? 'Gửi và chuyển sang câu tiếp theo' : 'Phiên đã hoàn thành') : 'Gửi vào tập nghiên cứu'
  $('start').disabled = guided && !step
  $('submit').hidden = guided && !step
  if (guided) {
    $('session-progress').textContent = step ? 'Bước ' + (sessionIndex + 1) + ' / ' + GUIDED_STEPS.length : 'Đã hoàn thành ' + GUIDED_STEPS.length + ' / ' + GUIDED_STEPS.length
    $('progress-bar').style.width = Math.round((Math.min(sessionIndex + 1, GUIDED_STEPS.length) / GUIDED_STEPS.length) * 100) + '%'
    $('session-hint').textContent = step ? step.hint : 'Toàn bộ bản ghi đã được gửi. Cảm ơn bạn đã tham gia.'
  }
}
function advanceSession() {
  sessionIndex += 1; saveSession(); resetRecording(); renderPrompt()
  return sessionIndex < GUIDED_STEPS.length
}

document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.tab,.panel').forEach((node) => node.classList.remove('active'))
  button.classList.add('active'); $(button.dataset.tab).classList.add('active')
}))
document.querySelectorAll('.mode').forEach((button) => button.addEventListener('click', () => {
  mode = button.dataset.mode
  document.querySelectorAll('.mode').forEach((node) => node.classList.toggle('active', node === button))
  resetRecording(); renderPrompt()
}))
$('restart-session').addEventListener('click', restartSession)
$('free-text').addEventListener('input', () => { resetRecording(); renderPrompt() })
$('redo').addEventListener('click', resetRecording)
$('start').addEventListener('click', async () => {
  if (!promptText()) return message('message', 'Hãy nhập câu tiếng Nhật trước.')
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return message('message', 'Trình duyệt này chưa hỗ trợ ghi âm. Hãy dùng Chrome, Edge hoặc Firefox mới.')
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false } })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined
    const chunks = []; recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data)
    recorder.onstop = () => {
      recordingMs = Math.max(250, Math.round(performance.now() - startedAt)); recording = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      recordingUrl = URL.createObjectURL(recording); $('preview').src = recordingUrl; $('preview').hidden = false; $('redo').hidden = false
      $('submit').disabled = !$('consent').checked; $('recorder-state').textContent = 'Đã ghi ' + (recordingMs / 1000).toFixed(1) + ' giây. Nghe lại rồi gửi.'
      stream.getTracks().forEach((track) => track.stop())
    }
    recorder.start(); startedAt = performance.now(); $('start').hidden = true; $('stop').hidden = false; message('message', '')
  } catch (error) { message('message', error?.name === 'NotAllowedError' ? 'Bạn cần cho phép sử dụng micro.' : 'Không thể mở micro.') }
})
$('stop').addEventListener('click', () => { if (recorder?.state === 'recording') recorder.stop(); $('start').hidden = false; $('stop').hidden = true })
$('consent').addEventListener('change', () => { $('submit').disabled = !recording || !$('consent').checked })
$('record-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const participantCode = $('participant-code').value.trim()
  if (!recording || !participantCode || !$('consent').checked) return message('message', 'Cần có mã người tham gia, bản ghi và đồng ý nghiên cứu.')
  const step = guidedStep()
  const body = mode === 'guided'
    ? { participantCode, collectionMode: 'guided', scenarioKey: step.key, textJa: step.text, instructedVariant: step.variant, sessionId, sessionStep: sessionIndex + 1, consent: true }
    : { participantCode, collectionMode: 'free', textJa: promptText(), consent: true }
  try {
    $('submit').disabled = true; message('message', 'Đang lưu thông tin…')
    const created = await fetch('/api/attempts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(readApi)
    if (recording.size > created.maxUploadBytes) throw new Error('Bản ghi vượt quá 20 MB.')
    message('message', 'Đang tải bản ghi…')
    await fetch(created.uploadUrl + '?durationMs=' + recordingMs, { method: 'PUT', headers: { 'content-type': recording.type }, body: recording }).then(readApi)
    if (mode === 'guided') {
      const hasNext = advanceSession()
      message('message', hasNext ? 'Đã lưu. Mời bạn đọc câu tiếp theo.' : 'Đã hoàn thành phiên thu. Cảm ơn bạn!', true)
    } else {
      message('message', 'Đã gửi thành công. Mã lượt thu: ' + created.attempt.id.slice(0, 8), true); resetRecording()
    }
  } catch (error) { message('message', error.message || 'Không thể gửi bản ghi.') }
})
async function readApi(response) { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error?.message || 'Yêu cầu thất bại.'); return data }

async function loadQueue() {
  reviewKey = $('review-key').value; if (!reviewKey) return message('review-message', 'Nhập mã người chấm trước.')
  try { const data = await fetch('/api/review-queue', { headers: { 'x-research-review-key': reviewKey } }).then(readApi); reviewItems = data.items; selectedAttempt = reviewItems[0] || null; renderQueue(); message('review-message', reviewItems.length ? '' : 'Chưa có bản ghi nào chờ chấm.', true) } catch (error) { message('review-message', error.message || 'Không tải được hàng chờ.') }
}
$('load-queue').addEventListener('click', loadQueue)
function renderQueue() {
  $('review-content').hidden = !selectedAttempt; const queue = $('queue'); queue.innerHTML = ''
  reviewItems.forEach((item) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = item.id === selectedAttempt?.id ? 'active' : ''; button.innerHTML = '<b lang="ja"></b><small></small>'
    button.querySelector('b').textContent = item.textJa; button.querySelector('small').textContent = item.collectionMode === 'free' ? 'Tự do · ' + item.participantCode : item.targetError + ' · ' + item.participantCode
    button.onclick = () => { selectedAttempt = item; renderQueue() }; queue.append(button)
  })
  if (selectedAttempt) loadAudio(selectedAttempt)
}
async function loadAudio(item) {
  $('review-text').textContent = item.textJa; $('unit-reference').value = item.targetPhone || ''; if (reviewAudioUrl) URL.revokeObjectURL(reviewAudioUrl)
  try { const response = await fetch('/api/attempts/' + item.id + '/audio/content', { headers: { 'x-research-review-key': reviewKey } }); if (!response.ok) throw new Error('Không thể tải audio.'); reviewAudioUrl = URL.createObjectURL(await response.blob()); $('review-audio').src = reviewAudioUrl } catch (error) { message('review-message', error.message || 'Không thể tải audio.') }
}
$('label-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!selectedAttempt) return
  const body = { unitType: $('unit-type').value, unitReference: $('unit-reference').value.trim(), label: $('label').value, errorType: $('label').value === 'correct' ? undefined : $('error-type').value, confidence: Number($('confidence').value), notes: $('notes').value.trim() }
  try { await fetch('/api/attempts/' + selectedAttempt.id + '/labels', { method: 'POST', headers: { 'content-type': 'application/json', 'x-research-review-key': reviewKey }, body: JSON.stringify(body) }).then(readApi); message('review-message', 'Đã lưu nhãn.', true); $('notes').value = ''; await loadQueue() } catch (error) { message('review-message', error.message || 'Không thể lưu nhãn.') }
})
restoreSession(); saveSession(); renderPrompt()
