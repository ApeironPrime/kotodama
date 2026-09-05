import os
import re
import json
import base64
import time
import urllib.request
import pdfplumber

# 1. Setup paths
BASE_DIR = r"d:\VKU\DoAnTN\kotodama"
DATA_DIR = os.path.join(BASE_DIR, "data")
SCRIPTS_DIR = os.path.join(DATA_DIR, "n3_scripts")
OUTPUT_MASTER = os.path.join(DATA_DIR, "jlpt_n3_toan_master.json")
EXPLANATIONS_FILE = os.path.join(DATA_DIR, "jlpt_explanations.json")

XOR_KEY = "trungseo"
BASE_API = "https://rquuavjcxmrsmvxhqhrj.supabase.co/functions/v1"

def js_sd(b64_str):
    raw_bytes = base64.b64decode(b64_str)
    try:
        return raw_bytes.decode('utf-8')
    except Exception:
        return raw_bytes.decode('latin1')

def js_wd(s, key=XOR_KEY):
    res = []
    key_codes = [ord(c) for c in key]
    for i, ch in enumerate(s):
        res.append(chr(ord(ch) ^ key_codes[i % len(key_codes)]))
    return "".join(res)

def js_rh(val):
    if val is None:
        return ""
    if isinstance(val, (int, float)):
        return str(val)
    try:
        s = js_sd(val)
        dec = js_wd(s, XOR_KEY)
        try:
            parsed = json.loads(dec)
            if isinstance(parsed, str):
                try:
                    return json.loads(parsed)
                except Exception:
                    return parsed
            return parsed
        except Exception:
            return dec
    except Exception as e:
        return f"Err: {e}"

def normalize_digits(text):
    zenkaku = "０１２３４５６７８９"
    hankaku = "0123456789"
    table = str.maketrans(zenkaku, hankaku)
    return text.translate(table)

# 2. Extract PDF Scripts cleanly using pdfplumber without tiny furigana
def load_all_pdf_scripts():
    print("Loading and parsing PDF scripts cleanly with pdfplumber from:", SCRIPTS_DIR)
    pdf_scripts = {}
    if not os.path.exists(SCRIPTS_DIR):
        print("Scripts dir not found!")
        return pdf_scripts

    for root, dirs, files in os.walk(SCRIPTS_DIR):
        for file in files:
            if file.endswith(".pdf") and "script" in file.lower():
                full_path = os.path.join(root, file)
                parent = os.path.basename(root)
                match = re.search(r'(\d{1,2})[-.](\d{4})', parent) or re.search(r'(\d{1,2})[-.](\d{4})', file) or re.search(r'(\d{4})[-.](\d{1,2})', parent)
                if match:
                    g1, g2 = match.group(1), match.group(2)
                    if len(g1) == 4:
                        year, month = int(g1), int(g2)
                    else:
                        month, year = int(g1), int(g2)
                else:
                    match2 = re.search(r'N3[^\d]*(\d{1,2})[^\d]+(\d{4})', parent + " " + file, re.IGNORECASE)
                    if match2:
                        month, year = int(match2.group(1)), int(match2.group(2))
                    else:
                        continue
                
                try:
                    full_text = []
                    with pdfplumber.open(full_path) as pdf:
                        for page in pdf.pages:
                            # Filter out tiny furigana characters (< 8.5 pt)
                            filtered_page = page.filter(lambda obj: obj.get("object_type") != "char" or obj.get("size", 10) >= 8.5)
                            p_text = filtered_page.extract_text() or ""
                            clean_lines = []
                            for line in p_text.splitlines():
                                line_s = line.strip()
                                if re.match(r'^JLPT[・\s]+N\d', line_s, re.IGNORECASE):
                                    continue
                                if re.match(r'^\d{1,2}$', line_s):
                                    continue
                                clean_lines.append(line)
                            full_text.append("\n".join(clean_lines))

                    joined_text = normalize_digits("\n".join(full_text))
                    pdf_scripts[(year, month)] = joined_text
                    print(f"Parsed PDF script for {month:02d}/{year}: {len(joined_text)} chars")
                except Exception as e:
                    print(f"Error reading PDF {full_path}: {e}")

    return pdf_scripts

# 3. Helper to find script snippet for a listening question
def find_script_snippet(pdf_text, mondai_idx, q_num):
    if not pdf_text:
        return None
    
    mondai_splits = re.split(r'問題\s*([1-5])', pdf_text)
    target_block = ""
    for i in range(1, len(mondai_splits), 2):
        m_num = int(mondai_splits[i])
        if m_num == mondai_idx:
            target_block = mondai_splits[i+1]
            break
            
    if not target_block:
        target_block = pdf_text

    patterns = [
        rf'(?:^|\n|\r)\s*{q_num}\s*番',
        rf'(?:^|\n|\r)\s*問(?:題)?\s*{q_num}',
        rf'(?:^|\n|\r)\s*質問\s*{q_num}',
        rf'(?:^|\n|\r)\s*\(?\s*{q_num}\s*\)',
        rf'(?:^|\n|\r)\s*{q_num}\s*[.:、]',
    ]
    
    for pat in patterns:
        q_splits = re.split(pat, target_block)
        if len(q_splits) > 1:
            content_after = q_splits[1]
            next_q = re.split(r'(?:^|\n|\r)\s*(?:\d+\s*番|問題\s*\d|問\s*\d|質問\s*\d)', content_after)
            snippet = next_q[0].strip()
            if len(snippet) > 5:
                return snippet

    if mondai_idx == 5:
        q_splits = re.split(r'(?:^|\n|\r)\s*3\s*番', target_block)
        if len(q_splits) > 1:
            snippet = q_splits[1].strip()
            if len(snippet) > 5:
                return snippet

    return None

# 4. Main Crawl and Transform
def crawl_all_n3_exams():
    pdf_scripts = load_all_pdf_scripts()
    
    # Load explanations
    explanations = {}
    if os.path.exists(EXPLANATIONS_FILE):
        try:
            with open(EXPLANATIONS_FILE, "r", encoding="utf-8") as f:
                explanations = json.load(f)
            print(f"Loaded {len(explanations)} explanations from {EXPLANATIONS_FILE}")
        except Exception as e:
            print(f"Error loading explanations: {e}")

    print("\nFetching exam list for N3 from ToanSensei...")
    list_url = f"{BASE_API}/jlpt-get-exam-list?level=3"
    req = urllib.request.Request(list_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        exam_list_data = json.loads(resp.read().decode('utf-8'))
    
    exam_codes = exam_list_data.get("data", [])
    print(f"Total N3 exam codes: {len(exam_codes)}")

    all_full_mock_exams = []
    
    for idx, code in enumerate(exam_codes, 1):
        m_match = re.match(r't(\d+)n(\d+)', code)
        if not m_match:
            continue
        
        month = int(m_match.group(1))
        year = int(m_match.group(2))
        
        print(f"\n[{idx}/{len(exam_codes)}] Fetching exam: {code} (Tháng {month:02d}/{year})...")
        detail_url = f"{BASE_API}/jlpt-get-exam-detail?m={month}&y={year}&n=3"
        
        try:
            req_det = urllib.request.Request(detail_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req_det) as resp_det:
                raw_det = json.loads(resp_det.read().decode('utf-8'))
        except Exception as e:
            print(f"Error fetching {code}: {e}")
            continue

        raw_items = raw_det.get("data", [])
        if not raw_items:
            print(f"No items in {code}")
            continue

        pdf_text = pdf_scripts.get((year, month), "")

        exam_parts = []
        global_q_num = 1
        total_q_count = 0

        section_names_map = {
            1: ("Kiến thức ngôn ngữ (Từ vựng)", "言語知識（文字・語彙）"),
            2: ("Kiến thức ngôn ngữ (Ngữ pháp)", "言語知識（文法）"),
            3: ("Đọc hiểu", "読解"),
            4: ("Nghe hiểu", "聴解")
        }

        for item in raw_items:
            dec_mondai = js_rh(item.get("mondai", ""))
            try:
                mondai_int = int(str(dec_mondai))
            except Exception:
                mondai_int = 1

            sec_vn, sec_jp = section_names_map.get(mondai_int, ("Phần thi JLPT", "試験"))
            
            groups = js_rh(item.get("cauhoi", ""))
            if not isinstance(groups, list):
                continue

            for g_idx, grp in enumerate(groups, 1):
                tieude = grp.get("tieudemondai", "") or grp.get("title", "")
                questions_in_grp = grp.get("questions", [])
                
                # Extract Mondai audio if present
                grp_audio = next((q.get("audio_url") for q in questions_in_grp if q.get("audio_url")), None)

                part_questions = []
                for q in questions_in_grp:
                    q_id_raw = q.get("id", global_q_num)
                    
                    q_cauhoi = q.get("cauhoi", "") or ""
                    opt1 = q.get("dapan1", "") or ""
                    opt2 = q.get("dapan2", "") or ""
                    opt3 = q.get("dapan3", "") or ""
                    opt4 = q.get("dapan4", "") or ""
                    
                    ans_raw = q.get("dapan", 1)
                    try:
                        ans_int = int(ans_raw)
                    except Exception:
                        ans_int = 1
                        
                    diem_raw = q.get("diem", 1)
                    try:
                        diem_float = float(str(diem_raw).replace(",", "."))
                    except Exception:
                        diem_float = 1.0

                    mondaidoc = q.get("mondaidoc", "") or ""
                    q_audio_url = q.get("audio_url", "") or grp_audio or ""

                    options = [str(opt1), str(opt2), str(opt3), str(opt4)]
                    while options and options[-1] == "":
                        options.pop()
                    if not options:
                        options = ["1", "2", "3", "4"]

                    script_text = None
                    if mondai_int == 4 and pdf_text:
                        script_text = find_script_snippet(pdf_text, g_idx, len(part_questions) + 1)

                    # Bulletproof Explanation lookup with exact index matching
                    exp_key_exact = f"t{month}n{year}_{global_q_num}"
                    exp_key_zero = f"t{month}n{year}_{global_q_num - 1}"
                    exp_key_id = f"t{month}n{year}_{q_id_raw}"

                    explanation = None
                    if exp_key_exact in explanations and explanations[exp_key_exact].strip().startswith(f"{global_q_num}."):
                        explanation = explanations[exp_key_exact]
                    elif exp_key_zero in explanations and explanations[exp_key_zero].strip().startswith(f"{global_q_num}."):
                        explanation = explanations[exp_key_zero]
                    elif exp_key_exact in explanations:
                        explanation = explanations[exp_key_exact]
                    elif exp_key_id in explanations:
                        explanation = explanations[exp_key_id]

                    part_questions.append({
                        "id": f"toan_q_{year}_{month:02d}_{q_id_raw}",
                        "number": global_q_num,
                        "groupQuestionNumber": len(part_questions) + 1,
                        "question": str(q_cauhoi),
                        "sentence": str(q_cauhoi),
                        "options": options,
                        "correctAnswer": ans_int,
                        "answer": ans_int,
                        "scoreWeight": diem_float,
                        "mondaiNumber": mondai_int,
                        "mondaiGroupIndex": g_idx,
                        "passage": mondaidoc if mondaidoc else None,
                        "audio": q_audio_url if q_audio_url else None,
                        "audioUrl": q_audio_url if q_audio_url else None,
                        "script": script_text,
                        "explanation": explanation,
                    })
                    global_q_num += 1

                if part_questions:
                    total_q_count += len(part_questions)
                    exam_parts.append({
                        "id": f"toan_part_{year}_{month:02d}_m{mondai_int}_g{g_idx}",
                        "title": f"{sec_vn} - Mondai {g_idx}",
                        "titleJP": f"{sec_jp} - 問題 {g_idx}",
                        "instruction": tieude,
                        "sectionType": mondai_int,
                        "audioUrl": grp_audio,
                        "questions": part_questions,
                    })

        exam_obj = {
            "id": f"toan-n3-{year}{month:02d}-full",
            "title": f"JLPT N3 - Tháng {month:02d}/{year} (Thi Thử Trọn Gói 180 Điểm)",
            "level": "N3",
            "year": str(year),
            "session": str(month),
            "section": "full_mock",
            "sectionLabel": "Thi Thử Trọn Gói",
            "sectionLabelJP": "総合模擬試験",
            "timeLimit": 140,
            "totalQuestions": total_q_count,
            "isFullMock": True,
            "parts": exam_parts,
        }

        all_full_mock_exams.append(exam_obj)
        print(f" -> Success: {exam_obj['title']} ({len(exam_parts)} parts, {total_q_count} questions)")
        time.sleep(0.1)

    with open(OUTPUT_MASTER, "w", encoding="utf-8") as f:
        json.dump(all_full_mock_exams, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 50)
    print(f"Successfully processed {len(all_full_mock_exams)} N3 Full Mock Exams!")
    print(f"Saved master file to: {OUTPUT_MASTER} ({os.path.getsize(OUTPUT_MASTER)} bytes)")

if __name__ == "__main__":
    crawl_all_n3_exams()
