const SCENARIOS = {
  tsu_chu: { text: '私はつくえを使います。', phone: 'ts', error: 'tsu_to_chu', hint: 'Phân biệt つ với ちゅ. Phiên bản lỗi: cố tình đọc つ gần như “chu”.' },
  sokuon: { text: '切手を買いました。', phone: 'cl', error: 'sokuon', hint: 'Giữ một khoảng ngắt ngắn trước て. Phiên bản lỗi: cố tình bỏ khoảng ngắt.' },
  long_vowel: { text: 'ケーキを食べました。', phone: 'e', error: 'long_vowel', hint: 'Kéo dài ー đủ rõ. Phiên bản lỗi: đọc ngắn trường âm.' },
  mora_n: { text: '新聞を読みます。', phone: 'N', error: 'mora_n', hint: 'Giữ mora ん riêng trước ぶん. Phiên bản lỗi: nuốt hoặc bỏ ん.' },
}
let mode = 'scripted', recording = null, recordingUrl = null, recorder = null, startedAt = 0, recordingMs = 0, reviewKey = '', reviewItems = [], selectedAttempt = null, reviewAudioUrl = null
const $ = (id) => document.getElementById(id)
const message = (id, value, ok = false) => { const node = $(id); node.textContent = value; node.style.color = ok ? '#8ee0bb' : '#f5b1c9' }
function selectedScenario() { return SCENARIOS[$('scenario').value] }
function promptText() { return mode === 'scripted' ? selectedScenario().text : $('free-text').value.trim() }
function renderPrompt() { $('prompt-text').textContent = promptText() || 'Nhập câu tiếng Nhật trước.'; $('scenario-hint').textContent = selectedScenario().hint }
function resetRecording() { if (recordingUrl) URL.revokeObjectURL(recordingUrl); recording = null; recordingUrl = null; recordingMs = 0; $('preview').hidden = true; $('preview').removeAttribute('src'); $('redo').hidden = true; $('submit').disabled = true; $('recorder-state').textContent = 'Sẵn sàng ghi một câu.' }

document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.tab,.panel').forEach((node) => node.classList.remove('active'))
  button.classList.add('active'); $(button.dataset.tab).classList.add('active')
}))
document.querySelectorAll('.mode').forEach((button) => button.addEventListener('click', () => {
  mode = button.dataset.mode; document.querySelectorAll('.mode').forEach((node) => node.classList.toggle('active', node === button)); $('scripted-fields').hidden = mode !== 'scripted'; $('free-fields').hidden = mode !== 'free'; resetRecording(); renderPrompt()
}))
$('scenario').addEventListener('change', () => { resetRecording(); renderPrompt() })
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
    recorder.onstop = () => { recordingMs = Math.max(250, Math.round(performance.now() - startedAt)); recording = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); recordingUrl = URL.createObjectURL(recording); $('preview').src = recordingUrl; $('preview').hidden = false; $('redo').hidden = false; $('submit').disabled = !$('consent').checked; $('recorder-state').textContent = `Đã ghi ${(recordingMs / 1000).toFixed(1)} giây. Nghe lại rồi gửi.`; stream.getTracks().forEach((track) => track.stop()) }
    recorder.start(); startedAt = performance.now(); $('start').hidden = true; $('stop').hidden = false; message('message', '')
  } catch (error) { message('message', error?.name === 'NotAllowedError' ? 'Bạn cần cho phép sử dụng micro.' : 'Không thể mở micro.') }
})
$('stop').addEventListener('click', () => { if (recorder?.state === 'recording') recorder.stop(); $('start').hidden = false; $('stop').hidden = true })
$('consent').addEventListener('change', () => { $('submit').disabled = !recording || !$('consent').checked })
$('record-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const participantCode = $('participant-code').value.trim(); if (!recording || !participantCode || !$('consent').checked) return message('message', 'Cần có mã người tham gia, bản ghi và đồng ý nghiên cứu.')
  const scenario = selectedScenario(); const body = mode === 'scripted' ? { participantCode, collectionMode: mode, scenarioKey: $('scenario').value, textJa: scenario.text, instructedVariant: document.querySelector('input[name="variant"]:checked').value, consent: true } : { participantCode, collectionMode: mode, textJa: promptText(), consent: true }
  try { $('submit').disabled = true; message('message', 'Đang lưu thông tin…'); const created = await fetch('/api/attempts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(readApi); if (recording.size > created.maxUploadBytes) throw new Error('Bản ghi vượt quá 20 MB.'); message('message', 'Đang tải bản ghi…'); await fetch(`${created.uploadUrl}?durationMs=${recordingMs}`, { method: 'PUT', headers: { 'content-type': recording.type }, body: recording }).then(readApi); message('message', `Đã gửi thành công. Mã lượt thu: ${created.attempt.id.slice(0, 8)}`, true); resetRecording() } catch (error) { message('message', error.message || 'Không thể gửi bản ghi.') }
})
async function readApi(response) { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error?.message || 'Yêu cầu thất bại.'); return data }

async function loadQueue() {
  reviewKey = $('review-key').value; if (!reviewKey) return message('review-message', 'Nhập mã người chấm trước.')
  try { const data = await fetch('/api/review-queue', { headers: { 'x-research-review-key': reviewKey } }).then(readApi); reviewItems = data.items; selectedAttempt = reviewItems[0] || null; renderQueue(); message('review-message', reviewItems.length ? '' : 'Chưa có bản ghi nào chờ chấm.', true) } catch (error) { message('review-message', error.message || 'Không tải được hàng chờ.') }
}
$('load-queue').addEventListener('click', loadQueue)
function renderQueue() {
  $('review-content').hidden = !selectedAttempt; const queue = $('queue'); queue.innerHTML = ''
  reviewItems.forEach((item) => { const button = document.createElement('button'); button.type = 'button'; button.className = item.id === selectedAttempt?.id ? 'active' : ''; button.innerHTML = `<b lang="ja"></b><small></small>`; button.querySelector('b').textContent = item.textJa; button.querySelector('small').textContent = item.collectionMode === 'free' ? `Tự do · ${item.participantCode}` : `${item.targetError} · ${item.participantCode}`; button.onclick = () => { selectedAttempt = item; renderQueue() }; queue.append(button) })
  if (selectedAttempt) loadAudio(selectedAttempt)
}
async function loadAudio(item) {
  $('review-text').textContent = item.textJa; $('unit-reference').value = item.targetPhone || ''; if (reviewAudioUrl) URL.revokeObjectURL(reviewAudioUrl)
  try { const response = await fetch(`/api/attempts/${item.id}/audio/content`, { headers: { 'x-research-review-key': reviewKey } }); if (!response.ok) throw new Error('Không thể tải audio.'); reviewAudioUrl = URL.createObjectURL(await response.blob()); $('review-audio').src = reviewAudioUrl } catch (error) { message('review-message', error.message || 'Không thể tải audio.') }
}
$('label-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!selectedAttempt) return
  const body = { unitType: $('unit-type').value, unitReference: $('unit-reference').value.trim(), label: $('label').value, errorType: $('label').value === 'correct' ? undefined : $('error-type').value, confidence: Number($('confidence').value), notes: $('notes').value.trim() }
  try { await fetch(`/api/attempts/${selectedAttempt.id}/labels`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-research-review-key': reviewKey }, body: JSON.stringify(body) }).then(readApi); message('review-message', 'Đã lưu nhãn.', true); $('notes').value = ''; await loadQueue() } catch (error) { message('review-message', error.message || 'Không thể lưu nhãn.') }
})
renderPrompt()
