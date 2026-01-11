<template>
  <div class="container">
    <h1>课文背诵测试器 (Alpha)</h1>

    <div v-if="!isTesting && !isFinished">
      <!-- Step 1: list of texts -->
      <div v-if="viewStep===1">
        <h2>选择课文列表</h2>
            <div class="preset-grid">
              <div v-for="list in textLists" :key="list.name" class="preset-card" @click="selectText(list.name)">
                <div class="preset-title">{{ list.title }}</div>
              </div>
            </div>
      </div>

      <!-- Step 2: sections -->
      <div v-if="viewStep===2 && loadedText">
        <h2>选择章节</h2>
        <div class="book-grid">
          <div v-for="(sec, idx) in loadedText.sections" :key="sec.id" class="book-card" :class="{selected: selectedSectionIndex===idx}" @click="selectSection(idx)">
            {{ sec.title }}
          </div>
        </div>
        <div style="margin-top:1rem; text-align:center;">
          <button class="start-test-button" @click="viewStep=1">返回课文列表</button>
        </div>
      </div>

      <!-- Step 3: paragraph preview and multi-select original text -->
      <div v-if="viewStep===3 && currentSection">
        <h2>{{ currentSection.title }} - 选择段落并预览原文（可多选）</h2>
        <div style="text-align:center; margin-bottom:0.5rem;">
          <label>
            <input type="checkbox" v-model="textShowHint" @change="saveShowHintSetting" /> 在测试时显示首字母提示
          </label>
        </div>
        <div class="unit-grid">
          <div v-for="(p, idx) in currentSection.paragraphs" :key="p.id" class="unit-card" :class="{selected: selectedParagraphs.includes(idx)}" @click="selectParagraph(idx)">
            <div class="unit-card-title">段落 {{ idx+1 }} <span class="unit-count">({{ p.sentences.length }}句)</span></div>
            <div class="paragraph-card-preview">{{ p.sentences.map(s=>s.text).join(' ') }}</div>
          </div>
        </div>

        <div v-if="selectedParagraphs.length>0" class="paragraph-preview" style="margin-top:1rem; text-align:left;">
          <h3>已选段落 ({{ selectedParagraphs.length }}) - 预览原文</h3>
          <div>
            <div v-for="pIdx in selectedParagraphs" :key="pIdx" style="margin-bottom:0.75rem; border-bottom:1px dashed #ddd; padding-bottom:0.5rem;">
                <strong>段 {{ pIdx + 1 }}</strong>
              <p v-for="(s, si) in currentSection.paragraphs[pIdx].sentences" :key="s.id">{{ si+1 }}. {{ s.text }}</p>
            </div>
          </div>
          <div style="margin-top:1rem;">
            <button class="start-test-button" @click="startTest">开始测试所选段落</button>
            <button class="start-test-button" @click="viewStep=2" style="margin-left:0.5rem;">返回章节</button>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="isTesting">
      <h2>测试中（一次性呈现所有句子）</h2>
      <div class="progress-bar-container">
        <div class="progress-text">已答: {{ testItems.flatMap(i=>i.tokens).filter(t=>t.blank && t.user && t.user.trim().length>0).length }} / {{ totalBlanks }}（{{ progressPercentage }}%）</div>
        <div class="progress-bar" :style="{ width: progressPercentage + '%' }"></div>
      </div>

      <div class="test-container">
        <p class="sentence-preview">来源: {{ loadedText ? loadedText.title : '' }} - {{ currentSection ? currentSection.title : '' }} - 段落 {{ selectedParagraphs.length>0 ? selectedParagraphs.map(i=>i+1).join(',') : '' }}</p>

        <!-- hint option removed from testing area; configured on selection page -->

        <div class="all-items">
          <div v-for="item in testItems" :key="item.index" class="test-item" style="margin-bottom:1rem; text-align:left;">
            <div class="original-label">{{ item.index+1 }}. </div>
            <div class="item-tokens">
              <template v-for="(t, ti) in item.tokens" :key="ti">
                <span v-if="t.blank">
                  <span v-if="textShowHint" class="hint before">{{ t.text ? t.text[0] : '' }}</span>
                  <input v-model="t.user" class="cloze-input" placeholder="..." />
                </span>
                <span v-else class="cloze-fixed">{{ t.text }}</span>
                <span> </span>
              </template>
              <div style="margin-top:0.25rem;">
                <button class="start-test-button" @click.prevent="item.showAnswers = !item.showAnswers">{{ item.showAnswers ? '隐藏答案' : '逐句查看答案' }}</button>
              </div>
              <div v-if="item.showAnswers" style="margin-top:0.5rem; color:#666;">
                答案:
                <span class="answer-chips">
                  <span v-for="(t, ti) in item.tokens" :key="ti">
                    <span v-if="t.blank" class="answer-chip">{{ t.text }}</span>
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <p v-if="feedback" :class="{correct: feedback.correct, incorrect: !feedback.correct}">{{ feedback.message }}</p>

        <div class="controls">
          <button class="submit-button" @click="submitAnswer">提交并评估</button>
          <button class="exit-button" @click="cancelTest">退出</button>
        </div>
      </div>
    </div>

    <div v-else>
      <h2>测试完成</h2>
      <p class="result">正确率: {{ totalBlanks>0 ? ((correctCount/totalBlanks)*100).toFixed(2) : 0 }}% ({{ correctCount }} / {{ totalBlanks }})</p>
      <details open>
        <summary>错误句 ({{ incorrectRecords.length }})</summary>
        <div class="error-list">
          <div v-for="rec in incorrectRecords" :key="rec.index" class="error-record">
            <div class="error-record-title">句 {{ rec.index+1 }}: <span class="orig-text">{{ rec.original }}</span></div>
            <div class="error-wrongs">
              <span v-for="(w, wi) in rec.wrong" :key="wi" class="wrong-chip">正确: {{ w.expected }} <span class="user-answer">你: {{ w.actual }}</span></span>
            </div>
          </div>
        </div>
      </details>
      <button class="download-button" @click="downloadIncorrect">下载错误 JSON</button>
      <button class="reset-button" @click="resetAll">重新开始</button>
    </div>
  </div>
</template>

<script>
import listData from "./assets/js/text/list.json";

// 简单词性判定：助词/代词列表（英文简化）
const FUNCTION_WORDS = new Set([
  "a","an","the","and","or","but","if","is","are","was","were","be","am","do","does","did","have","has","had","I","you","he","she","it","we","they","me","him","her","them","this","that","these","those","my","your","his","her","its","our","their","to","of","in","on","for","with","at","by","from","as","about","into","over","after","before","between","so","too","very","not","no","yes","Picasso","Georges","Braque","Mozart","The Magic Flute","can","could","would","Les Demoiselles d’Avignon","Kun","kung","fu","Makgatho","Mandela"
]);

export default {
  data() {
    return {
      textLists: listData,
      selectedText: null,
      loadedText: null,
  selectedSectionIndex: null,
  selectedParagraphIndex: null,
  selectedParagraphs: [], // 支持多选段落索引
      viewStep: 1, // 1=list, 2=sections, 3=paragraph preview
      isTesting: false,
      isFinished: false,
      sentences: [],
  currentSentenceIndex: 0,
  clozeTokens: [],
  testItems: [], // 当次测试的所有句子与分词（一次性呈现）
  totalBlanks: 0,
      textShowHint: false,
      feedback: null,
      correctCount: 0,
      incorrectRecords: [],
    };
  },
  created() {
    // 从 localStorage 读取用户设置（与 VocabTester 保持一致）
    const savedShowHint = localStorage.getItem("textShowHint");
    if (savedShowHint !== null) this.textShowHint = savedShowHint === "false";
  },
  computed: {
    currentSection() {
      return this.loadedText && this.loadedText.sections[this.selectedSectionIndex];
    },
    currentSentence() {
      return this.sentences[this.currentSentenceIndex] || { text: '' };
    },
    progressPercentage() {
      if (this.totalBlanks === 0) return 0;
      const answered = this.testItems.flatMap(item => item.tokens).filter(t => t.blank && t.user && t.user.trim().length>0).length;
      return ((answered / this.totalBlanks) * 100).toFixed(2);
    },
    correctRate() {
      if (this.totalBlanks === 0) return (0).toFixed(2);
      return ((this.correctCount / this.totalBlanks) * 100).toFixed(2);
    }
  },
  methods: {
    async selectText(name) {
      this.selectedText = name;
      try {
        const module = await import(`./assets/js/text/${name}.json`);
        this.loadedText = module;
        this.selectedSectionIndex = null;
        this.selectedParagraphIndex = null;
        this.viewStep = 2; // go to sections view
      } catch (err) {
        console.error('无法加载课文', err);
        alert('无法加载课文数据');
      }
    },
    selectSection(idx) {
      this.selectedSectionIndex = idx;
      this.selectedParagraphIndex = null;
      this.viewStep = 3; // show paragraph preview for this section
    },
    selectParagraph(idx) {
      // toggle selection for multi-select paragraph indexes
      const pos = this.selectedParagraphs.indexOf(idx);
      if (pos === -1) {
        this.selectedParagraphs.push(idx);
      } else {
        this.selectedParagraphs.splice(pos, 1);
      }
      // 保留最后选中的索引用作预览上下文
      this.selectedParagraphIndex = idx;
    },
    startTest() {
      // collect sentences from all selectedParagraphs (sorted)
      const paraIndexes = this.selectedParagraphs.slice().sort((a,b)=>a-b);
      const collected = [];
      for (const pi of paraIndexes) {
        const p = this.currentSection.paragraphs[pi];
        if (p && p.sentences) collected.push(...p.sentences.map(s=>({ ...s })));
      }
      this.sentences = collected;
      this.currentSentenceIndex = 0;
      this.correctCount = 0;
      this.incorrectRecords = [];
      this.testItems = [];
      this.totalBlanks = 0;

      // build test items: for each sentence, choose 1-2 random non-function words to blank unless <=5 words
      for (let si = 0; si < this.sentences.length; si++) {
        const s = this.sentences[si].text;
        // split into tokens similar to prepareClozeForCurrent
        const tokens = s.split(/(\s+|[.,!?;:"()—’‘\u2019])/).filter(t=>t!==undefined && t!=='');
        // collect indices of word tokens and their cleaned words
        const wordTokenIndexes = [];
        const cleanedWords = [];
        tokens.forEach((t, ti) => {
          const trimmed = t.trim();
          if (!trimmed) return;
          const word = trimmed.replace(/[^A-Za-z']/g, '');
          if (word) {
            const isFunc = FUNCTION_WORDS.has(word) || FUNCTION_WORDS.has(word.toLowerCase());
            if (!isFunc) {
              wordTokenIndexes.push(ti);
              cleanedWords.push(word);
            }
          }
        });

        // determine blanks: skip if total word tokens (including function?) <=5 — we use cleanedWords + function words count
        const totalWordCount = tokens.map(t=>t.trim()).filter(t=>t && /[A-Za-z]/.test(t)).length;
        let blanksForSentence = [];
        if (totalWordCount > 5 && wordTokenIndexes.length>0) {
          // ensure at least 1 blank per sentence if possible, prefer 1-2
          const maxPossible = wordTokenIndexes.length;
          const chooseCount = Math.min(maxPossible, Math.random() < 0.4 ? 1 : 2);
          const shuffled = wordTokenIndexes.slice().sort(()=>Math.random()-0.5);
          blanksForSentence = shuffled.slice(0, chooseCount);
        }

        // build item tokens
        const itemTokens = tokens.map((t, ti) => {
          const trimmed = t.trim();
          if (!trimmed) return { type: 'fixed', text: t };
          const word = trimmed.replace(/[^A-Za-z']/g, '');
          if (!word) return { type: 'fixed', text: t };
          const shouldBlank = blanksForSentence.includes(ti);
          return shouldBlank ? { type: 'word', text: word, blank: true, user: '' } : { type: 'word', text: word, blank: false };
        });

  this.testItems.push({ index: si, original: s, tokens: itemTokens, showAnswers: false });
        this.totalBlanks += itemTokens.filter(t=>t.blank).length;
      }

      this.isTesting = true;
      this.isFinished = false;
      this.viewStep = 0; // testing view
    },
    saveShowHintSetting() {
      try {
        localStorage.setItem('textShowHint', this.textShowHint);
      } catch (e) {
        console.warn('无法保存 textShowHint 设置到 localStorage', e);
      }
    },
    prepareClozeForCurrent() {
      // legacy; not used in the all-at-once mode
    },
    submitAnswer() {
      // helper: Levenshtein distance
      const levenshtein = (a, b) => {
        const A = a || '';
        const B = b || '';
        const m = A.length, n = B.length;
        const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
          for (let j = 1; j <= n; j++) {
            const cost = A[i-1] === B[j-1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost);
          }
        }
        return dp[m][n];
      };

      // Evaluate all testItems at once
      let totalBlankCount = 0;
      let totalCorrect = 0;
      this.incorrectRecords = [];
      this.testItems.forEach(item => {
        const itemWrong = [];
        item.tokens.forEach(t => {
          if (t.blank) {
            totalBlankCount++;
            const user = (t.user || '').trim().toLowerCase();
            const correct = (t.text || '').trim().toLowerCase();
            // accept exact match or edit distance <=1 as correct
            const dist = levenshtein(user, correct);
            if (user === correct || dist <= 1) totalCorrect++;
            else itemWrong.push({ expected: correct, actual: user });
          }
        });
        if (itemWrong.length>0) {
          this.incorrectRecords.push({ index: item.index, original: item.original, wrong: itemWrong });
        }
      });

      this.totalBlanks = totalBlankCount;
      this.correctCount = totalCorrect; // store blank-level correct count
      this.feedback = { correct: totalBlankCount>0 && totalCorrect===totalBlankCount, message: `已评估：${totalCorrect}/${totalBlankCount} 个空正确` };
      this.finishTest();
    },
    finishTest() {
      this.isTesting = false;
      this.isFinished = true;
      this.viewStep = 1;
      // keep selections but you may choose to clear them
    },
    cancelTest() {
      this.isTesting = false;
      this.isFinished = false;
      this.resetAll();
    },
    resetAll() {
      this.selectedText = null;
      this.loadedText = null;
      this.selectedSectionIndex = null;
      this.selectedParagraphIndex = null;
      this.selectedParagraphs = [];
      this.viewStep = 1;
      this.sentences = [];
      this.currentSentenceIndex = 0;
      this.clozeTokens = [];
      this.feedback = null;
      this.correctCount = 0;
      this.incorrectRecords = [];
      this.isTesting = false;
      this.isFinished = false;
    },
    downloadIncorrect() {
      const data = {
        source: this.selectedText,
        section: this.selectedSectionIndex,
        paragraphs: this.selectedParagraphs,
        incorrect: this.incorrectRecords
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `text_incorrect_${this.selectedText}_${this.selectedSectionIndex}_${this.selectedParagraphs.join('-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}
</script>

<style scoped>
.container { max-width: 900px; margin: 0 auto; padding: 1rem; }
.list-container { display:flex; gap:1rem; flex-wrap:wrap; justify-content:center; }
.list-button { padding:0.5rem 1rem; border-radius:6px; cursor:pointer; }
.book-grid, .unit-grid { display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:center; margin-top:0.5rem; }
.book-card, .unit-card { padding:0.75rem 1rem; border-radius:6px; cursor:pointer; }
.book-card.selected, .unit-card.selected { border:2px solid #3b82f6; }
.test-container { text-align:center; }
.cloze-input { min-width:4rem; padding:0.25rem; }
.cloze-fixed { color: #333; }
.progress-bar-container { width:100%; background:#eee; border-radius:6px; position:relative; height:1.25rem; margin-bottom:1rem; }
.progress-bar { height:100%; background:#3b82f6; transition:width 0.3s; }
.progress-text { position:absolute; left:50%; transform:translateX(-50%); top:0; font-weight:bold; }
.correct { color:green; }
.incorrect { color:red; }
.controls { margin-top:1rem; display:flex; gap:0.5rem; justify-content:center; }
.result { font-size:1.1rem; font-weight:bold; }
.paragraph-preview { 
  max-height: none; 
  overflow: visible; 
  background: #fafafa; 
  padding: 0.6rem; 
  border-radius: 6px; 
  border: 1px solid #eee;
}
.paragraph-preview p { 
  white-space: normal; 
  word-break: break-word; 
  margin: 0.25rem 0; 
}
.paragraph-card-preview {
  margin-top: 0.25rem;
  color: #555;
  font-size: 0.9rem;
  max-height: 8rem; /* allow more lines */
  overflow: auto; /* scroll if still long */
  white-space: normal;
  word-break: break-word;
}
.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}
.preset-card {
  background: linear-gradient(180deg, #fff, #fafafa);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  cursor: pointer;
  border: 1px solid #e6e6e6;
  transition: transform .12s ease, box-shadow .12s ease;
}
.preset-card:hover { transform: translateY(-3px); box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
.book-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap:0.75rem; }
.book-card { padding:0.75rem; border-radius:8px; background:#fff; border:1px solid #eee; cursor:pointer; text-align:center; }
.book-card.selected { border-color: #3b82f6; box-shadow: 0 6px 18px rgba(59,130,246,0.08); transform: translateY(-2px); }
.unit-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:0.75rem; }
.unit-card { background:#fff; border:1px solid #eee; padding:0.8rem; border-radius:8px; cursor:pointer; transition: box-shadow .12s ease, transform .12s ease; }
.unit-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.04); }
.unit-card.selected { background: linear-gradient(90deg,#eef6ff,#f8fbff); border:1px solid #cfe3ff; box-shadow: 0 8px 20px rgba(59,130,246,0.06); }
.unit-card-title { font-weight:600; color:var(--text-color); }
.unit-count { font-weight:400; color:#888; font-size:0.85rem; margin-left:0.25rem; }

.start-test-button, .submit-button, .download-button, .reset-button, .exit-button { background:#3b82f6; color:white; border:none; padding:0.6rem 1rem; border-radius:8px; cursor:pointer; font-weight:600; }
.start-test-button:hover, .submit-button:hover, .download-button:hover, .reset-button:hover, .exit-button:hover { background:#2563eb; }
.exit-button { background:#ff4d4f; }
.exit-button:hover { background:#d9363a; }

.cloze-input { min-width:6rem; padding:0.5rem 0.6rem; border-radius:6px; border:1px solid #ddd; }
.cloze-input:focus { outline:none; border-color:#3b82f6; box-shadow:0 6px 18px rgba(59,130,246,0.06); }
.hint.before { display:inline-flex; align-items:center; justify-content:center; width:1.2rem; height:1.6rem; margin-right:0.25rem; background:rgba(59,130,246,0.08); color:#1e3a8a; border-radius:4px; font-weight:700; }

.test-item { background:#fff; border:1px solid #eee; padding:0.75rem; border-radius:8px; }
.test-item .original-label { display:inline-block; width:2rem; font-weight:600; color:#333; }
.item-tokens { display:inline-block; }
.all-items { display:flex; flex-direction:column; gap:0.75rem; }

.progress-bar-container { height:1.1rem; border-radius:8px; overflow:hidden; background:#f1f5f9; margin-bottom:1rem; }
.progress-bar { background:linear-gradient(90deg,#60a5fa,#2563eb); height:100%; transition: width .25s ease; }
.progress-text { position:relative; text-align:center; font-weight:700; font-size:0.9rem; margin-bottom:0.6rem; }
.hint.before {
  display: inline-block;
  width: 1.2rem;
  text-align: center;
  margin-right: 0.25rem;
  font-weight: bold;
  color: var(--secondary-color, #666);
}

/* Answer chip styles */
.answer-chips { display:inline-flex; gap:0.4rem; flex-wrap:wrap; align-items:center; }
.answer-chip { background: #eef2ff; color: #1e3a8a; padding: 0.25rem 0.5rem; border-radius: 999px; font-weight:600; border:1px solid #dbeafe; margin-right:0.25rem; }
.wrong-chip { display:inline-block; background:#fff1f0; color:#b91c1c; padding:0.28rem 0.5rem; border-radius:6px; border:1px solid #fecaca; margin:0.18rem; }
.user-answer { display:block; font-size:0.85rem; color:#6b7280; margin-top:0.15rem; }
.error-record { padding:0.6rem; border-bottom:1px dashed #eee; }
.error-record-title { font-weight:600; margin-bottom:0.45rem; }
.orig-text { color:#374151; font-weight:500; }
</style>
