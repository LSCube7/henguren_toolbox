<template>
  <div class="container" :class="{ 'wrongbook-layout': showWrongBookPage }">
    <transition name="page-fade" mode="out-in">
    <div v-if="showWrongBookPage" key="wrongbook-page" class="wrongbook-page">
      <div class="wrongbook-page-header">
        <h2>错题本</h2>
        <div class="wrongbook-page-actions">
          <button
            class="download-button"
            :disabled="filteredWrongBookRecords.length === 0"
            @click="startWrongBookTest"
          >
            开始错题测试
          </button>
          <button class="download-button" @click="refreshWrongBookPage">刷新</button>
          <button class="reset-button" @click="closeWrongBookPage">返回主页</button>
        </div>
      </div>

      <div class="wrongbook-stats">
        <div class="wrongbook-stat-card">
          <span class="wrongbook-stat-label">测试次数</span>
          <span class="wrongbook-stat-value">{{ wrongBookStats.testCount }}</span>
        </div>
        <div class="wrongbook-stat-card">
          <span class="wrongbook-stat-label">总错误次数</span>
          <span class="wrongbook-stat-value">{{ wrongBookStats.totalWrongCount }}</span>
        </div>
        <div class="wrongbook-stat-card">
          <span class="wrongbook-stat-label">记录单词数</span>
          <span class="wrongbook-stat-value">{{ wrongBookStats.recordWordCount }}</span>
        </div>
      </div>

      <div class="wrongbook-filter-bar">
        <input
          v-model="wrongBookSearchKeyword"
          class="wrongbook-filter-input"
          placeholder="搜索单词"
        />
        <div class="wrongbook-filter-right">
          <div class="wrongbook-level-buttons" role="group" aria-label="按错误次数筛选">
            <button
              v-for="item in wrongBookLevelOptions"
              :key="item.value"
              class="wrongbook-level-button"
              :class="{ active: wrongBookFilterLevel === item.value }"
              @click="wrongBookFilterLevel = item.value"
            >
              {{ item.label }}
            </button>
          </div>
          <select v-model="wrongBookFilterSource" class="wrongbook-select">
            <option value="all">全部来源</option>
            <option v-for="source in wrongBookSourceOptions" :key="source" :value="source">{{ source }}</option>
          </select>
        </div>
      </div>

      <div class="wrongbook-delete-tools">
        <label>
          按测试批次删除
          <select v-model.number="selectedDeleteTestNo" class="wrongbook-select">
            <option :value="null" disabled>请选择测试批次</option>
            <option v-for="batch in wrongBookBatches" :key="batch.testNo" :value="batch.testNo">
              第{{ batch.testNo }}次（{{ formatBatchTime(batch.createdAt) }}，{{ batch.syncedCount }}词）
            </option>
          </select>
        </label>
        <button class="reset-button" @click="deleteWrongRecordsByBatch">删除该次增加的次数</button>
      </div>

      <p v-if="wrongBookSyncMessage" class="wrongbook-message">{{ wrongBookSyncMessage }}</p>

      <ul v-if="filteredWrongBookRecords.length > 0" class="wrongbook-list">
        <li v-for="record in filteredWrongBookRecords" :key="record.id" class="wrongbook-item">
          <div class="wrongbook-item-main">
            <span class="wrongbook-word">{{ record.word }}</span>
          </div>
          <div class="wrongbook-tag-row">
            <div class="wrongbook-tag-left">
              <span class="wrongbook-tag">来源 {{ record.sourceName }}</span>
              <span :class="['wrongbook-tag', getWrongCountTagClass(record.wrongCount)]">错 {{ record.wrongCount }} 次</span>
            </div>
            <button class="reset-button wrongbook-delete-inline" @click="deleteOneWrongRecord(record.id)">删除</button>
          </div>
        </li>
      </ul>
      <p v-else class="wrongbook-empty">当前筛选条件下没有记录。</p>
    </div>

    <div v-else-if="!isTesting" key="select-page">
      <h2>选择单词列表</h2>

      <!-- 必修/选修册选择 -->
      <div class="preset-grid">
        <div 
          v-for="book in books" 
          :key="book.name" 
          class="preset-card"
          :class="{ 'active-card': isBookFullySelected(book.name) }"
          @click="toggleBookSelection(book.name)"
        >
          <div class="preset-title">{{ book.title }}</div>
          <div class="unit-grid">
            <div 
              v-for="unit in getUnitsForBook(book.name)" 
              :key="unit.name" 
              class="unit-card"
              :class="{ 'active-card': selectedUnits.includes(unit.name) }"
              @click.stop="toggleUnitSelection(unit.name)"
            >
              Unit {{ unit.name.slice(-1) }}
            </div>
          </div>
        </div>

        <!-- 自定义上传卡片 -->
        <div class="preset-card custom-card">
          <div class="preset-title">自定义单词列表</div>
          <div class="unit-grid">
            <div 
              v-for="(file, index) in uploadedFiles" 
              :key="file.id || index" 
              class="unit-card"
              :class="{ 'active-card': selectedFiles.includes(file.id) }"
              @click="toggleFileSelection(file.id)"
              style="width: 2.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
            >
              {{ file.name }}
            </div>
            <label class="unit-card upload-card" style="width: 2.5rem;">
              上传...
              <input 
                type="file" 
                accept=".json" 
                @change="uploadCustomList" 
                style="display: none;" 
              />
            </label>
          </div>
        </div>
      </div>

      <!-- 开始测试按钮 -->
      <div class="start-test-container">
        <div class="test-options">
          <button 
            class="test-option-button" 
            :class="{ active: testMode === 'all' }" 
            :disabled="selectedUnits.length === 0"
            @click="setTestMode('all')"
          >
            全部
          </button>
          <button 
            class="test-option-button" 
            :class="{ active: testMode === 'custom' }" 
            :disabled="selectedUnits.length === 0"
            @click="setTestMode('custom')"
          >
            自定义
          </button>
        </div>

        <div v-if="testMode === 'custom'" class="custom-test-container">
          <label for="test-count" class="test-count-label">测试数量：</label>
          <input 
            id="test-count" 
            type="number" 
            v-model.number="testCount" 
            class="test-count-input" 
            placeholder=""
            @input="validateTestCount"
          />
          <span class="test-count-hint" :class="{ error: testCountError }">
            {{ testCountError || `范围：1-${maxTestCount}` }}
          </span>
        </div>

        <button 
          @click="startTestHandler" 
          class="start-test-button" 
          :disabled="selectedUnits.length === 0 && selectedFiles.length === 0"
        >
          开始测试
        </button>
        <button @click="openWrongBookPage" class="start-test-button wrongbook-entry-button">打开错题本</button>
      </div>

      <!-- 新增高级设置 -->
      <details class="advanced-settings">
        <summary>高级设置</summary>
        <br />
        <div class="settings-container">
          <label>
            <input type="checkbox" v-model="showHint" @change="saveShowHintSetting" />
            显示首字母提示
          </label>
          <br />
          <label>
            <input type="checkbox" v-model="enableSlipDetection" @change="saveSlipDetectionSetting" />
            启用手滑判定
          </label>
        </div>
      </details>
    </div>

    <div v-else-if="currentWordIndex < shuffledWords.length" key="testing-page">
      <h2>测试中</h2>
      <div class="progress-bar-container">
        <div class="progress-text">
          {{ currentWordIndex + 1 }}/{{ shuffledWords.length }}（{{ progressPercentage }}%）
        </div>
        <div class="progress-bar" :style="{ width: progressPercentage + '%' }"></div>
      </div>
      <div class="test-container">
        <p class="definition">英文释义: {{ shuffledWords[currentWordIndex].en_definition.join("; ") }}</p>
        <div class="input-container">
          <span v-if="showHint" class="hint">{{ shuffledWords[currentWordIndex].word[0] }}</span>
          <input ref="answerInput" v-model="userInput" placeholder="输入单词" class="input-box" @keydown.enter.prevent="checkAnswer" />
        </div>
        <button @click="checkAnswer" class="submit-button">提交</button>
        <p v-if="feedback" :class="{
          correct: feedback.correct,
          incorrect: !feedback.correct && !feedback.slip,
          slip: feedback.slip,
        }" class="feedback">
          {{ feedback.message }}
          <button v-if="feedback.slip" @click="markSlipAsIncorrect" class="mark-incorrect-button">
            判定为错误
          </button>
        </p>
        <br />
        <button @click="generatePrintableTest" class="print-button">创建测试打印版</button>
      </div>
      <button @click="exitTest" class="exit-button">退出测试</button>
    </div>
    <div v-else key="result-page">
      <h2>测试完成</h2>
      <div class="completion-panel">
        <div class="score-card">
          <p class="score-label">本次正确率</p>
          <p class="score-value">{{ correctRate }}%</p>
          <p class="score-meta">共 {{ shuffledWords.length }} 题，答对 {{ correctCount }} 题</p>
        </div>

        <div class="stats-grid">
          <div class="stat-pill stat-pill-correct">
            <span class="stat-pill-title">正确</span>
            <span class="stat-pill-value">{{ correctWords.length }}</span>
          </div>
          <div class="stat-pill stat-pill-incorrect">
            <span class="stat-pill-title">错误</span>
            <span class="stat-pill-value">{{ incorrectWords.length }}</span>
          </div>
        </div>

        <div class="results-container">
          <details class="result-detail incorrect-detail" open>
            <summary>错误单词 ({{ incorrectWords.length }})</summary>
            <ul class="result-list">
              <li v-for="word in incorrectWords" :key="word.word" class="result-item">
                <span class="result-word">{{ word.word }}</span>
                <span class="result-definition">{{ word.en_definition.join("; ") }}</span>
              </li>
            </ul>
          </details>

          <details class="result-detail correct-detail">
            <summary>正确单词 ({{ correctWords.length }})</summary>
            <ul class="result-list">
              <li v-for="word in correctWords" :key="word.word" class="result-item">
                <span class="result-word">{{ word.word }}</span>
              </li>
            </ul>
          </details>
        </div>

        <div class="result-actions">
          <button @click="downloadIncorrectWords" class="download-button result-action-button">下载错误单词 JSON</button>
          <button @click="resetTest" class="reset-button result-action-button">重新开始</button>
          <button @click="openWrongBookPage" class="download-button result-action-button">打开错题本</button>
        </div>

        <div class="wrongbook-controls">
          <button
            class="download-button result-action-button"
            :disabled="currentResultSyncedToWrongBook || incorrectWords.length === 0"
            @click="syncCurrentIncorrectToWrongBook"
          >
            {{ currentResultSyncedToWrongBook ? '本次已计入' : '计入错题本' }}
          </button>
          <p v-if="wrongBookSyncMessage" class="wrongbook-message">{{ wrongBookSyncMessage }}</p>
        </div>

        <details class="wrongbook-panel" open>
          <summary>错题本（IndexedDB）{{ wrongBookRecords.length > 0 ? ` (${wrongBookRecords.length})` : '' }}</summary>
          <div class="wrongbook-stats">
            <div class="wrongbook-stat-card">
              <span class="wrongbook-stat-label">测试次数</span>
              <span class="wrongbook-stat-value">{{ wrongBookStats.testCount }}</span>
            </div>
            <div class="wrongbook-stat-card">
              <span class="wrongbook-stat-label">总错误次数</span>
              <span class="wrongbook-stat-value">{{ wrongBookStats.totalWrongCount }}</span>
            </div>
            <div class="wrongbook-stat-card">
              <span class="wrongbook-stat-label">记录单词数</span>
              <span class="wrongbook-stat-value">{{ wrongBookStats.recordWordCount }}</span>
            </div>
          </div>

          <div class="wrongbook-delete-tools">
            <label>
              按测试批次删除
              <select v-model.number="selectedDeleteTestNo" class="wrongbook-select">
                <option :value="null" disabled>请选择测试批次</option>
                <option v-for="batch in wrongBookBatches" :key="batch.testNo" :value="batch.testNo">
                  第{{ batch.testNo }}次（{{ formatBatchTime(batch.createdAt) }}，{{ batch.syncedCount }}词）
                </option>
              </select>
            </label>
            <button class="reset-button" @click="deleteWrongRecordsByBatch">删除该次增加的次数</button>
          </div>
        </details>
      </div>
    </div>
    </transition>
  </div>
</template>

<script>
import listData from "./assets/js/vocabulary/list.json";

export default {
  data() {
    return {
      books: [
        { name: "R1", title: "必修一" },
        { name: "R2", title: "必修二" },
        { name: "R3", title: "必修三" },
        { name: "O1", title: "选择性必修一" },
        { name: "O2", title: "选择性必修二" },
        { name: "O3", title: "选择性必修三" },
        { name: "O4", title: "选择性必修四" }
      ],
      selectedUnits: [],
      wordLists: listData,
      words: [],
      shuffledWords: [],
      currentWordIndex: 0,
      userInput: "",
      feedback: null,
      correctCount: 0,
      incorrectWords: [],
      correctWords: [],
      isTesting: false,
      showHint: true, // 新增属性，默认显示首字母
      enableSlipDetection: false, // 新增属性，默认不启用手滑判定
      selectedLists: [], // 新增属性，存储选中的单词列表
      testCount: 10, // 默认测试数量为10
      testCountError: null, // 新增属性，存储测试数量的错误信息
      testMode: 'all', // 新增属性，默认测试模式为全部
      maxTestCount: 100, // 新增属性，最大测试数量
      uploadedFileName: "", // 新增属性，存储上传的文件名
      uploadedFiles: [], // 新增属性，存储上传的文件列表
      selectedFiles: [], // 初始化选中的文件列表
      wrongBookDb: null,
      wrongBookDbPromise: null,
      wrongBookRecords: [],
      currentResultSyncedToWrongBook: false,
      wrongBookSyncMessage: "",
      wrongBookBatches: [],
      selectedDeleteTestNo: null,
      showWrongBookPage: false,
      wrongBookFilterLevel: "all",
      wrongBookFilterSource: "all",
      wrongBookSearchKeyword: "",
    };
  },
  computed: {
    correctRate() {
      return ((this.correctCount / this.shuffledWords.length) * 100).toFixed(2);
    },
    progressPercentage() {
      return ((this.currentWordIndex / this.shuffledWords.length) * 100).toFixed(2);
    },
    wrongBookStats() {
      const totalWrongCount = this.wrongBookRecords.reduce((sum, record) => sum + (record.wrongCount || 0), 0);
      return {
        testCount: this.wrongBookBatches.length,
        totalWrongCount,
        recordWordCount: this.wrongBookRecords.length,
      };
    },
    wrongBookSourceOptions() {
      const sources = new Set(this.wrongBookRecords.map((record) => record.sourceName || "未知来源"));
      return Array.from(sources).sort((a, b) => String(a).localeCompare(String(b)));
    },
    wrongBookLevelOptions() {
      return [
        { label: "全部", value: "all" },
        { label: "1", value: "1" },
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "3+", value: "3plus" },
      ];
    },
    filteredWrongBookRecords() {
      const keyword = (this.wrongBookSearchKeyword || "").trim().toLowerCase();
      return this.wrongBookRecords.filter((record) => {
        const wrongCount = Number(record.wrongCount || 0);
        if (this.wrongBookFilterLevel === "1" && wrongCount !== 1) {
          return false;
        }
        if (this.wrongBookFilterLevel === "2" && wrongCount !== 2) {
          return false;
        }
        if (this.wrongBookFilterLevel === "3" && wrongCount !== 3) {
          return false;
        }
        if (this.wrongBookFilterLevel === "3plus" && wrongCount < 3) {
          return false;
        }

        if (this.wrongBookFilterSource !== "all" && (record.sourceName || "") !== this.wrongBookFilterSource) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        return String(record.word || "").toLowerCase().includes(keyword);
      });
    },
  },
  created() {
    this.wordLists = listData;
    this.ensureWrongBookDb();
    this.loadCustomLibraries();
    this.loadWrongBookRecords();
    this.loadWrongBookBatches();
    // 从 localStorage 读取用户设置
    const savedShowHint = localStorage.getItem("showHint");
    if (savedShowHint !== null) {
      this.showHint = savedShowHint === "true";
    }
    const savedEnableSlipDetection = localStorage.getItem("enableSlipDetection");
    if (savedEnableSlipDetection !== null) {
      this.enableSlipDetection = savedEnableSlipDetection === "true";
    }
  },
  watch: {
    isTesting(newVal) {
      if (newVal) {
        this.focusAnswerInput(8);
      }
    },
    currentWordIndex() {
      if (this.isTesting && this.currentWordIndex < this.shuffledWords.length) {
        this.focusAnswerInput(6);
      }
    },
    showWrongBookPage(newVal) {
      if (!newVal && this.isTesting && this.currentWordIndex < this.shuffledWords.length) {
        this.focusAnswerInput(6);
      }
    },
  },
  methods: {
    focusAnswerInput(retry = 0) {
      this.$nextTick(() => {
        const input = this.$refs.answerInput;
        if (input && typeof input.focus === "function") {
          input.focus();
          if (typeof input.select === "function") {
            input.select();
          }
          return;
        }

        if (retry > 0) {
          setTimeout(() => this.focusAnswerInput(retry - 1), 45);
        }
      });
    },
    async openWrongBookPage() {
      this.showWrongBookPage = true;
      await this.refreshWrongBookPage();
    },
    closeWrongBookPage() {
      this.showWrongBookPage = false;
    },
    async refreshWrongBookPage() {
      await this.loadWrongBookRecords();
      await this.loadWrongBookBatches();
    },
    async resolveWrongBookRecordsToWords(records) {
      const safeRecords = Array.isArray(records) ? records : [];
      if (safeRecords.length === 0) {
        return [];
      }

      const sourceModuleCache = {};
      const resolvedWords = [];

      for (const record of safeRecords) {
        const definitionIndex = Number.isInteger(record.definitionIndex) ? record.definitionIndex : 0;

        if (record.sourceType === "custom") {
          const customLibrary = this.uploadedFiles.find((file) => file.id === record.customLibraryId);
          if (!customLibrary || !customLibrary.content || !Array.isArray(customLibrary.content.vocabulary)) {
            continue;
          }

          const matchedWord = customLibrary.content.vocabulary.find((item) => item.word === record.word);
          if (!matchedWord || !Array.isArray(matchedWord.en_definition)) {
            continue;
          }

          const definition = matchedWord.en_definition[definitionIndex];
          if (!definition) {
            continue;
          }

          resolvedWords.push({
            word: matchedWord.word,
            en_definition: [definition],
            sourceType: "custom",
            sourceName: record.sourceName,
            customLibraryId: record.customLibraryId,
            definitionIndex,
          });
          continue;
        }

        const sourceName = record.sourceName;
        if (!sourceName) {
          continue;
        }

        if (!sourceModuleCache[sourceName]) {
          try {
            sourceModuleCache[sourceName] = await import(`./assets/js/vocabulary/${sourceName}.json`);
          } catch (error) {
            sourceModuleCache[sourceName] = null;
          }
        }

        const sourceModule = sourceModuleCache[sourceName];
        if (!sourceModule || !Array.isArray(sourceModule.vocabulary)) {
          continue;
        }

        const matchedWord = sourceModule.vocabulary.find((item) => item.word === record.word);
        if (!matchedWord || !Array.isArray(matchedWord.en_definition)) {
          continue;
        }

        const definition = matchedWord.en_definition[definitionIndex];
        if (!definition) {
          continue;
        }

        resolvedWords.push({
          word: matchedWord.word,
          en_definition: [definition],
          sourceType: "built-in",
          sourceName,
          definitionIndex,
        });
      }

      return resolvedWords;
    },
    async startWrongBookTest() {
      const records = this.filteredWrongBookRecords;
      if (!records || records.length === 0) {
        this.wrongBookSyncMessage = "当前筛选条件下没有可测试的错题。";
        return;
      }

      await this.loadCustomLibraries();
      const resolvedWords = await this.resolveWrongBookRecordsToWords(records);

      if (resolvedWords.length === 0) {
        this.wrongBookSyncMessage = "未能从词库解析出可测试题目，请先检查来源词库是否仍存在。";
        return;
      }

      this.words = resolvedWords;
      this.shuffledWords = this.shuffleArray([...resolvedWords]);
      this.currentWordIndex = 0;
      this.userInput = "";
      this.feedback = null;
      this.correctCount = 0;
      this.incorrectWords = [];
      this.correctWords = [];
      this.currentResultSyncedToWrongBook = false;
      this.wrongBookSyncMessage = "";
      this.showWrongBookPage = false;
      this.isTesting = true;
      this.focusAnswerInput();
    },
    toggleHint() {
      this.showHint = !this.showHint;
      // 保存用户设置到 localStorage
      localStorage.setItem("showHint", this.showHint);
    },
    saveShowHintSetting() {
      localStorage.setItem("showHint", this.showHint);
    },
    saveSlipDetectionSetting() {
      localStorage.setItem("enableSlipDetection", this.enableSlipDetection);
    },
    async startTest(listName) {
      this.selectedList = listName;
      const listModule = await import(`./assets/js/vocabulary/${listName}.json`);
      this.words = listModule.vocabulary.flatMap((word) =>
        word.en_definition.map((definition, definitionIndex) => ({
          word: word.word,
          en_definition: [definition],
          sourceType: "built-in",
          sourceName: listName,
          definitionIndex,
        }))
      );
      this.shuffledWords = this.shuffleArray([...this.words]);
      this.isTesting = true;
      this.currentWordIndex = 0;
      this.correctCount = 0;
      this.feedback = null;
      this.userInput = "";
      this.incorrectWords = [];
      this.correctWords = [];
      this.currentResultSyncedToWrongBook = false;
      this.wrongBookSyncMessage = "";
      this.focusAnswerInput();
    },
    async startBatchTest() {
      const allWords = [];

      for (const unitName of this.selectedUnits) {
        try {
          // 动态加载单元的 JSON 文件
          const listModule = await import(`./assets/js/vocabulary/${unitName}.json`);
          const words = listModule.vocabulary.flatMap((word) =>
            word.en_definition.map((definition, definitionIndex) => ({
              word: word.word,
              en_definition: [definition],
              sourceType: "built-in",
              sourceName: unitName,
              definitionIndex,
            }))
          );
          allWords.push(...words);
        } catch (error) {
          console.error(`无法加载单元 ${unitName} 的数据:`, error);
        }
      }

      // 根据用户选择的测试数量生成测试内容
      if (this.testCount >= allWords.length) {
        this.words = allWords;
      } else {
        this.words = this.shuffleArray(allWords).slice(0, this.testCount);
      }

      this.shuffledWords = this.shuffleArray([...this.words]);
      this.isTesting = true;
      this.currentWordIndex = 0;
      this.correctCount = 0;
      this.feedback = null;
      this.userInput = "";
      this.incorrectWords = [];
      this.correctWords = [];
      this.currentResultSyncedToWrongBook = false;
      this.wrongBookSyncMessage = "";
      this.focusAnswerInput();
    },
    shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    },
    async checkAnswer() {
      const currentWord = this.shuffledWords[this.currentWordIndex];
      const correctAnswer = currentWord.word.toLowerCase();
      const userAnswer = this.userInput.trim().toLowerCase();

      if (!userAnswer) {
        this.incorrectWords.push(currentWord);
        this.feedback = {
          correct: false,
          message: `错误！正确答案是: ${currentWord.word}`,
        };

        this.userInput = "";
        this.currentWordIndex++;
        return;
      }

      // 如果用户输入忽略了首字母，调整正确答案进行比较
      const adjustedCorrectAnswer = correctAnswer.slice(1);

      const isCorrect =
        userAnswer === correctAnswer || userAnswer === adjustedCorrectAnswer;

      if (isCorrect) {
        this.correctCount++;
        this.correctWords.push(currentWord);
        this.feedback = { correct: true, message: "正确！" };
      } else if (
        this.enableSlipDetection &&
        (this.isSlip(userAnswer, correctAnswer) ||
          this.isSlip(userAnswer, adjustedCorrectAnswer))
      ) {
        this.correctCount++;
        this.correctWords.push(currentWord);
        this.feedback = {
          correct: false,
          slip: true,
          checkedWord: currentWord,
          countedAsCorrect: true,
          message: `手滑！你输入的是: ${userAnswer}，正确答案是: ${currentWord.word}`,
        };
      } else {
        this.incorrectWords.push(currentWord);
        this.feedback = {
          correct: false,
          message: `错误！正确答案是: ${currentWord.word}`,
        };
      }

      this.userInput = "";
      this.currentWordIndex++;
      if (this.currentWordIndex < this.shuffledWords.length) {
        this.focusAnswerInput();
      }
    },
    isSlip(userAnswer, correctAnswer) {
      // 计算 Levenshtein 距离
      const calculateLevenshteinDistance = (a, b) => {
        const matrix = Array.from({ length: a.length + 1 }, () =>
          Array(b.length + 1).fill(0)
        );

        for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= a.length; i++) {
          for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
              matrix[i - 1][j] + 1, // 删除
              matrix[i][j - 1] + 1, // 插入
              matrix[i - 1][j - 1] + cost // 替换
            );
          }
        }

        return matrix[a.length][b.length];
      };

      // 调用函数计算距离
      const distance = calculateLevenshteinDistance(userAnswer, correctAnswer);

      // 如果编辑距离为 1 或 2，则判定为手滑
      return distance >= 1 && distance <= 2;
    },
    async markSlipAsIncorrect() {
      const slipWord = this.feedback?.checkedWord || this.shuffledWords[this.currentWordIndex - 1];

      if (this.feedback?.countedAsCorrect) {
        this.correctCount = Math.max(0, this.correctCount - 1);
        const correctWordIndex = this.correctWords.lastIndexOf(slipWord);
        if (correctWordIndex !== -1) {
          this.correctWords.splice(correctWordIndex, 1);
        }
      }

      this.incorrectWords.push(slipWord);
      this.feedback = {
        correct: false,
        slip: false,
        message: `错误！正确答案是: ${slipWord.word}`,
      };
    },
    resetTest() {
      this.isTesting = false;
      this.selectedList = null;
      this.words = [];
      this.shuffledWords = [];
      this.currentWordIndex = 0;
      this.userInput = "";
      this.feedback = null;
      this.correctCount = 0;
      this.incorrectWords = [];
      this.correctWords = [];
      this.currentResultSyncedToWrongBook = false;
      this.wrongBookSyncMessage = "";
    },
    downloadIncorrectWords() {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const incorrectData = {
        vocabulary: this.incorrectWords.map((word) => ({
          word: word.word,
          en_definition: word.en_definition,
        })),
      };
      const blob = new Blob([JSON.stringify(incorrectData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `incorrect_words_${timestamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
    toggleFileSelection(fileId) {
      if (this.selectedFiles.includes(fileId)) {
        this.selectedFiles = this.selectedFiles.filter((file) => file !== fileId);
      } else {
        this.selectedFiles.push(fileId);
      }
    },
    uploadCustomList(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const customList = JSON.parse(e.target.result);
            if (!customList.vocabulary || !Array.isArray(customList.vocabulary)) {
              throw new Error("文件格式不正确，缺少 'vocabulary' 数组");
            }
            const fileId = this.generateCustomLibraryId(file.name, customList);
            const libraryRecord = {
              id: fileId,
              name: file.name,
              content: customList,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            await this.saveCustomLibrary(libraryRecord);
            const existingIndex = this.uploadedFiles.findIndex((item) => item.id === fileId);
            if (existingIndex !== -1) {
              this.uploadedFiles.splice(existingIndex, 1, libraryRecord);
            } else {
              this.uploadedFiles.push(libraryRecord);
            }

            if (!this.selectedFiles.includes(fileId)) {
              this.selectedFiles.push(fileId); // 默认选中上传的文件
            }
          } catch (error) {
            alert("上传的文件格式不正确！请确保文件包含 'vocabulary' 数组。");
          }
        };
        reader.readAsText(file);
      }
    },
    startCustomTest() {
      if (this.selectedFiles.length > 0) {
        this.words = this.selectedFiles.flatMap((fileId) => {
          const file = this.uploadedFiles.find((f) => f.id === fileId);
          return file
            ? file.content.vocabulary.flatMap((word) =>
              (word.en_definition || []).map((definition, definitionIndex) => ({
                word: word.word,
                en_definition: [definition],
                sourceType: "custom",
                sourceName: file.name,
                customLibraryId: file.id,
                definitionIndex,
              }))
            )
            : [];
        });
        this.shuffledWords = this.shuffleArray([...this.words]);
        this.isTesting = true;
        this.currentWordIndex = 0;
        this.correctCount = 0;
        this.feedback = null;
        this.userInput = "";
        this.incorrectWords = [];
        this.correctWords = [];
        this.focusAnswerInput();
      } else {
        alert("请先上传有效的单词列表！");
      }
    },
    exitTest() {
      // 重置测试状态
      this.isTesting = false;
      this.selectedList = null;
      this.words = [];
      this.shuffledWords = [];
      this.currentWordIndex = 0;
      this.userInput = "";
      this.feedback = null;
      this.correctCount = 0;
      this.incorrectWords = [];
      this.correctWords = [];
      this.currentResultSyncedToWrongBook = false;
      this.wrongBookSyncMessage = "";
    },
    generatePrintableTest() {
      const currentDate = new Date().toLocaleString(); // 获取当前时间
      const sourceParts = [];
      if (this.selectedList) {
        sourceParts.push(this.selectedList);
      }
      if (Array.isArray(this.selectedUnits) && this.selectedUnits.length > 0) {
        sourceParts.push(...this.selectedUnits);
      }
      if (Array.isArray(this.selectedFiles) && this.selectedFiles.length > 0) {
        const selectedFileNames = this.selectedFiles
          .map((fileId) => {
            const matched = this.uploadedFiles.find((file) => file.id === fileId);
            return matched ? matched.name : null;
          })
          .filter(Boolean);
        sourceParts.push(...selectedFileNames);
      }
      const uniqueSources = [...new Set(sourceParts)].filter(Boolean);
      const sourceInfo = uniqueSources.length > 0 ? `来源：${uniqueSources.join(", ")}` : "来源：未记录";
      // 构建打印版的 HTML 内容
      const printableContent = `
      <html>
        <head>
          <title>测试打印版</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&display=swap');

            @page {
              size: A4;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 8mm;
              padding: 0;
              font-family: "Source Serif 4", "Noto Serif SC", "Songti SC", serif;
              color: #1f2937;
              line-height: 1.5;
            }

            .sheet {
              width: auto;
              max-width: 100%;
              margin: 0;
            }

            .header {
              border: 1px solid #d1d5db;
              border-radius: 10px;
              padding: 12px 14px;
              margin-bottom: 12px;
              background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
            }

            h1 {
              margin: 0;
              font-size: 20px;
              letter-spacing: 0.5px;
            }

            .meta {
              margin-top: 8px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              font-size: 12px;
              color: #4b5563;
            }

            .section {
              margin-top: 10px;
            }

            .section-title {
              margin: 0 0 8px;
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
            }

            .word-list {
              display: grid;
              grid-template-columns: 1fr;
              gap: 6px 14px;
            }

            .word-item {
              min-height: 32px;
              padding: 4px 0;
              border-bottom: 1px dashed #d1d5db;
              font-size: 13px;
              line-height: 1.85;
            }

            .word-index {
              display: inline-block;
              width: 24px;
              font-weight: 700;
              color: #111827;
            }

            .blank {
              display: inline-block;
              width: 72px;
              border-bottom: 1px solid #94a3b8;
              margin: 0 6px;
              vertical-align: middle;
              position: relative;
              top: 3px;
            }

            .hint {
              display: inline-block;
              font-weight: 700;
              color: #0f766e;
              margin-right: 2px;
            }

            .definition {
              color: #334155;
            }

            .answer-list {
              border: 1px solid #d1d5db;
              border-radius: 10px;
              padding: 10px 12px;
              background: #fafafa;
            }

            .answer-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 4px 10px;
              font-size: 12px;
            }

            .answer-item {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .footer {
              margin-top: 10px;
              font-size: 11px;
              color: #6b7280;
              text-align: right;
            }

            @media print {
              body {
                margin: 8mm;
              }

              .sheet {
                width: auto;
                margin: 0;
              }

              .header,
              .answer-list {
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <h1>单词测试打印版</h1>
              <div class="meta">
                <div>${sourceInfo}</div>
                <div>生成时间：${currentDate}</div>
              </div>
            </div>

            <section class="section">
              <h2 class="section-title">默写题目（共 ${this.shuffledWords.length} 题）</h2>
              <div class="word-list">
                ${this.shuffledWords
          .map(
            (word, index) => `
                  <div class="word-item">
                    <span class="word-index">${index + 1}.</span>
                    ${this.showHint ? `<span class="hint">${word.word[0]}</span>`
                : ""
              }
                    <span class="blank"></span>
                    <span class="definition">${word.en_definition.join("; ")}</span>
                  </div>
                `
          )
          .join("")}
              </div>
            </section>

            <section class="section answer-list">
              <h2 class="section-title">答案</h2>
              <div class="answer-grid">
                ${this.shuffledWords
                .map((word, index) => `<div class="answer-item">${index + 1}. ${word.word}</div>`)
                .join("")}
              </div>
            </section>

            <div class="footer">${sourceInfo}</div>
          </div>
        </body>
      </html>
    `;

      // 打开新窗口并写入内容
      const printWindow = window.open("", "_blank");
      printWindow.document.open();
      printWindow.document.write(printableContent);
      printWindow.document.close();

      // 等待字体加载完成后再打印，避免首屏字体闪烁或回退字体
      const triggerPrint = () => {
        printWindow.focus();
        printWindow.print();
      };

      if (printWindow.document.fonts && printWindow.document.fonts.ready) {
        printWindow.document.fonts.ready.then(() => {
          setTimeout(triggerPrint, 80);
        });
      } else {
        setTimeout(triggerPrint, 160);
      }
    },
    selectBookType(type) {
      this.selectedBookType = type;
      this.selectedUnits = []; // 重置单元选择
    },
    async toggleBookSelection(bookName) {
      const units = this.getUnitsForBook(bookName).map((unit) => unit.name);
      const isFullySelected = units.every((unit) => this.selectedUnits.includes(unit));

      if (isFullySelected) {
        // 如果该册的所有单元已选中，则取消选择
        this.selectedUnits = this.selectedUnits.filter((unit) => !units.includes(unit));
      } else {
        // 如果该册的部分或全部单元未选中，则全选
        this.selectedUnits = [...new Set([...this.selectedUnits, ...units])];
      }

      // 更新总单词数
      this.maxTestCount = await this.getTotalWords();
      this.validateTestCount(); // 验证当前输入的测试数量
    },
    async toggleUnitSelection(unitName) {
      if (this.selectedUnits.includes(unitName)) {
        this.selectedUnits = this.selectedUnits.filter((unit) => unit !== unitName);
      } else {
        this.selectedUnits.push(unitName);
      }

      // 更新总单词数
      this.maxTestCount = await this.getTotalWords();
      this.validateTestCount(); // 验证当前输入的测试数量
    },
    getUnitsForSelectedBook() {
      const prefix = this.selectedBook === "required" ? "R" : "O";
      return this.wordLists.filter((list) => list.name.startsWith(prefix));
    },
    getUnitsForSelectedBookType() {
      const prefix = this.selectedBookType === "required" ? "R" : "O";
      return this.wordLists.filter((list) => list.name.startsWith(prefix));
    },
    getUnitsForBook(bookName) {
      return this.wordLists.filter((list) => list.name.startsWith(bookName));
    },
    isBookFullySelected(bookName) {
      const units = this.getUnitsForBook(bookName).map((unit) => unit.name);
      return units.every((unit) => this.selectedUnits.includes(unit));
    },
    async validateTestCount() {
  const totalWords = await this.getTotalWords();
  this.maxTestCount = totalWords; // 直接赋值，无需使用 this.$set

  if (this.testCount <= 0) {
    this.testCountError = "测试数量必须大于 0";
  } else if (this.testCount > totalWords) {
    this.testCountError = `测试数量不能超过 ${totalWords}`;
  } else {
    this.testCountError = null;
  }
},
    async getTotalWords() {
      let totalWords = 0;

      for (const unitName of this.selectedUnits) {
        try {
          // 动态加载单元的 JSON 文件
          const listModule = await import(`./assets/js/vocabulary/${unitName}.json`);
          const vocabulary = listModule.vocabulary || [];
          totalWords += vocabulary.length;
        } catch (error) {
          console.error(`无法加载单元 ${unitName} 的数据:`, error);
        }
      }

      return totalWords;
    },
    async setTestMode(mode) {
      this.testMode = mode;
      if (mode === "all") {
        this.testCountError = null; // 清除错误信息
      } else if (mode === "custom") {
        this.maxTestCount = await this.getTotalWords(); // 动态获取最大测试数量
        this.validateTestCount(); // 验证当前输入的测试数量
      }
    },
    async startTestHandler() {
      const allWords = [];

      // 加载选中的单元单词
      for (const unitName of this.selectedUnits) {
        try {
          const listModule = await import(`./assets/js/vocabulary/${unitName}.json`);
          // 每个en_definition分开测试
          const words = listModule.vocabulary.flatMap((word) =>
            word.en_definition.map((definition, definitionIndex) => ({
              word: word.word,
              en_definition: [definition],
              sourceType: "built-in",
              sourceName: unitName,
              definitionIndex,
            }))
          );
          allWords.push(...words);
        } catch (error) {
          console.error(`无法加载单元 ${unitName} 的数据:`, error);
        }
      }

      // 加载选中的自定义文件单词
      for (const fileId of this.selectedFiles) {
        const file = this.uploadedFiles.find((f) => f.id === fileId);
        if (file) {
          // 每个en_definition分开测试
          const words = file.content.vocabulary.flatMap((word) =>
            word.en_definition.map((definition, definitionIndex) => ({
              word: word.word,
              en_definition: [definition],
              sourceType: "custom",
              sourceName: file.name,
              customLibraryId: file.id,
              definitionIndex,
            }))
          );
          allWords.push(...words);
        }
      }

      // 根据测试模式和测试数量生成测试内容
      if (allWords.length > 0) {
        if (this.testMode === 'custom' && this.testCount > 0) {
          this.words = this.shuffleArray(allWords).slice(0, this.testCount);
        } else {
          this.words = allWords;
        }
        this.shuffledWords = this.shuffleArray([...this.words]);
        this.isTesting = true;
        this.currentWordIndex = 0;
        this.correctCount = 0;
        this.feedback = null;
        this.userInput = "";
        this.incorrectWords = [];
        this.correctWords = [];
        this.currentResultSyncedToWrongBook = false;
        this.wrongBookSyncMessage = "";
        this.focusAnswerInput();
      } else {
        alert("请先选择单词列表或上传自定义单词列表！");
      }
    },
    ensureWrongBookDb() {
      if (this.wrongBookDbPromise) {
        return this.wrongBookDbPromise;
      }

      this.wrongBookDbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open("henguren-wrong-book", 2);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          if (!db.objectStoreNames.contains("wrongRecords")) {
            const wrongRecordsStore = db.createObjectStore("wrongRecords", { keyPath: "id" });
            wrongRecordsStore.createIndex("byLevel", "level", { unique: false });
            wrongRecordsStore.createIndex("byUpdatedAt", "updatedAt", { unique: false });
          }

          if (!db.objectStoreNames.contains("customLibraries")) {
            const customLibrariesStore = db.createObjectStore("customLibraries", { keyPath: "id" });
            customLibrariesStore.createIndex("byName", "name", { unique: false });
          }

          if (!db.objectStoreNames.contains("syncBatches")) {
            const syncBatchesStore = db.createObjectStore("syncBatches", { keyPath: "testNo" });
            syncBatchesStore.createIndex("byCreatedAt", "createdAt", { unique: false });
          }
        };

        request.onsuccess = () => {
          this.wrongBookDb = request.result;
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });

      return this.wrongBookDbPromise;
    },
    getWrongLevel(wrongCount) {
      if (wrongCount >= 4) {
        return "L3";
      }
      if (wrongCount >= 2) {
        return "L2";
      }
      return "L1";
    },
    buildWrongRecordId(wordItem) {
      const sourceType = wordItem.sourceType || "built-in";
      const sourceName = wordItem.sourceName || "unknown-source";
      const definitionIndex = Number.isInteger(wordItem.definitionIndex) ? wordItem.definitionIndex : 0;
      const customLibraryId = wordItem.customLibraryId || "";

      if (sourceType === "custom") {
        return `custom::${customLibraryId}::${wordItem.word}::${definitionIndex}`;
      }

      return `builtin::${sourceName}::${wordItem.word}::${definitionIndex}`;
    },
    generateCustomLibraryId(fileName, customList) {
      const payload = `${fileName}::${JSON.stringify(customList)}`;
      let hash = 5381;
      for (let i = 0; i < payload.length; i++) {
        hash = (hash * 33) ^ payload.charCodeAt(i);
      }
      return `custom-${fileName}-${(hash >>> 0).toString(36)}`;
    },
    formatBatchTime(isoText) {
      if (!isoText) {
        return "时间未知";
      }

      const date = new Date(isoText);
      if (Number.isNaN(date.getTime())) {
        return "时间未知";
      }

      return date.toLocaleString("zh-CN", {
        hour12: false,
      });
    },
    async runStoreAction(storeName, mode, action) {
      const db = await this.ensureWrongBookDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = action(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },
    async saveCustomLibrary(libraryRecord) {
      await this.runStoreAction("customLibraries", "readwrite", (store) => store.put(libraryRecord));
    },
    async getAllSyncBatches() {
      return this.runStoreAction("syncBatches", "readonly", (store) => store.getAll());
    },
    async saveSyncBatch(batchRecord) {
      await this.runStoreAction("syncBatches", "readwrite", (store) => store.put(batchRecord));
    },
    async deleteSyncBatch(testNo) {
      await this.runStoreAction("syncBatches", "readwrite", (store) => store.delete(testNo));
    },
    async loadCustomLibraries() {
      try {
        const allCustomLibraries = await this.runStoreAction("customLibraries", "readonly", (store) => store.getAll());
        this.uploadedFiles = Array.isArray(allCustomLibraries) ? allCustomLibraries : [];
      } catch (error) {
        console.error("读取自定义词库失败:", error);
      }
    },
    async loadWrongBookBatches() {
      try {
        const allBatches = await this.getAllSyncBatches();
        const safeBatches = Array.isArray(allBatches) ? allBatches : [];
        safeBatches.sort((a, b) => (b.testNo || 0) - (a.testNo || 0));
        this.wrongBookBatches = safeBatches;
        if (safeBatches.length > 0 && this.selectedDeleteTestNo === null) {
          this.selectedDeleteTestNo = safeBatches[0].testNo;
        }
      } catch (error) {
        console.error("读取测试批次失败:", error);
      }
    },
    async getNextTestNo() {
      const batches = await this.getAllSyncBatches();
      const safeBatches = Array.isArray(batches) ? batches : [];
      if (safeBatches.length === 0) {
        return 1;
      }
      return Math.max(...safeBatches.map((item) => item.testNo || 0)) + 1;
    },
    async getAllWrongRecords() {
      return this.runStoreAction("wrongRecords", "readonly", (store) => store.getAll());
    },
    async loadWrongBookRecords() {
      try {
        const records = await this.getAllWrongRecords();
        const safeRecords = Array.isArray(records) ? records : [];
        safeRecords.sort((a, b) => {
          if ((b.wrongCount || 0) !== (a.wrongCount || 0)) {
            return (b.wrongCount || 0) - (a.wrongCount || 0);
          }
          return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
        });
        this.wrongBookRecords = safeRecords;
      } catch (error) {
        console.error("读取错题本失败:", error);
      }
    },
    async syncCurrentIncorrectToWrongBook() {
      if (this.currentResultSyncedToWrongBook) {
        this.wrongBookSyncMessage = "本次结果已计入错题本。";
        return;
      }

      if (this.incorrectWords.length === 0) {
        this.wrongBookSyncMessage = "本次没有错题，无需写入。";
        return;
      }

      const testNo = await this.getNextTestNo();
      const now = new Date().toISOString();

      for (const wordItem of this.incorrectWords) {
        await this.recordWrongWord(wordItem, testNo);
      }

      await this.saveSyncBatch({
        testNo,
        createdAt: now,
        syncedCount: this.incorrectWords.length,
      });

      this.currentResultSyncedToWrongBook = true;
      this.wrongBookSyncMessage = `已写入第${testNo}次测试，共 ${this.incorrectWords.length} 条。`;
      await this.loadWrongBookRecords();
      await this.loadWrongBookBatches();
    },
    async deleteWrongRecordById(recordId) {
      await this.runStoreAction("wrongRecords", "readwrite", (store) => store.delete(recordId));
    },
    async deleteOneWrongRecord(recordId) {
      await this.deleteWrongRecordById(recordId);
      this.wrongBookSyncMessage = "已删除 1 条错题记录。";
      await this.loadWrongBookRecords();
    },
    async deleteWrongRecordsByBatch() {
      const testNo = Number(this.selectedDeleteTestNo);
      if (!Number.isInteger(testNo) || testNo <= 0) {
        this.wrongBookSyncMessage = "请先选择要删除的测试批次。";
        return;
      }

      const targetRecords = this.wrongBookRecords.filter((record) => {
        const contributions = record.testContributions || {};
        return Number(contributions[testNo] || 0) > 0;
      });

      if (targetRecords.length === 0) {
        this.wrongBookSyncMessage = "该测试批次没有可回滚的错题次数。";
        await this.deleteSyncBatch(testNo);
        await this.loadWrongBookBatches();
        return;
      }

      for (const record of targetRecords) {
        const nextRecord = { ...record };
        const contributions = { ...(nextRecord.testContributions || {}) };
        const delta = Number(contributions[testNo] || 0);
        delete contributions[testNo];

        nextRecord.wrongCount = Math.max(0, (nextRecord.wrongCount || 0) - delta);
        nextRecord.testContributions = contributions;
        nextRecord.level = this.getWrongLevel(nextRecord.wrongCount || 0);
        nextRecord.updatedAt = new Date().toISOString();

        if (nextRecord.wrongCount <= 0) {
          await this.deleteWrongRecordById(nextRecord.id);
        } else {
          await this.saveWrongRecord(nextRecord);
        }
      }

      await this.deleteSyncBatch(testNo);

      this.wrongBookSyncMessage = `已回滚第${testNo}次测试对错题本的增加次数。`;
      await this.loadWrongBookRecords();
      await this.loadWrongBookBatches();
    },
    async getWrongRecordById(recordId) {
      return this.runStoreAction("wrongRecords", "readonly", (store) => store.get(recordId));
    },
    async saveWrongRecord(record) {
      await this.runStoreAction("wrongRecords", "readwrite", (store) => store.put(record));
    },
    async recordWrongWord(wordItem, testNo = null) {
      try {
        const recordId = this.buildWrongRecordId(wordItem);
        const now = new Date().toISOString();
        const existingRecord = await this.getWrongRecordById(recordId);

        if (existingRecord) {
          const wrongCount = (existingRecord.wrongCount || 0) + 1;
          const contributions = { ...(existingRecord.testContributions || {}) };
          if (Number.isInteger(testNo) && testNo > 0) {
            contributions[testNo] = (contributions[testNo] || 0) + 1;
          }
          const updatedRecord = {
            ...existingRecord,
            wrongCount,
            level: this.getWrongLevel(wrongCount),
            testContributions: contributions,
            lastWrongAt: now,
            updatedAt: now,
          };
          await this.saveWrongRecord(updatedRecord);
          return;
        }

        const initialWrongCount = 1;
        const initialContributions = {};
        if (Number.isInteger(testNo) && testNo > 0) {
          initialContributions[testNo] = 1;
        }
        const newRecord = {
          id: recordId,
          sourceType: wordItem.sourceType || "built-in",
          sourceName: wordItem.sourceName || "unknown-source",
          customLibraryId: wordItem.customLibraryId || null,
          word: wordItem.word,
          definitionIndex: Number.isInteger(wordItem.definitionIndex) ? wordItem.definitionIndex : 0,
          wrongCount: initialWrongCount,
          rightCount: 0,
          level: this.getWrongLevel(initialWrongCount),
          testContributions: initialContributions,
          createdAt: now,
          updatedAt: now,
          lastWrongAt: now,
          lastRightAt: null,
        };

        await this.saveWrongRecord(newRecord);
      } catch (error) {
        console.error("记录错题失败:", error);
      }
    },
    async recordRightWord(wordItem) {
      try {
        const recordId = this.buildWrongRecordId(wordItem);
        const existingRecord = await this.getWrongRecordById(recordId);
        if (!existingRecord) {
          return;
        }

        const now = new Date().toISOString();
        const updatedRecord = {
          ...existingRecord,
          rightCount: (existingRecord.rightCount || 0) + 1,
          lastRightAt: now,
          updatedAt: now,
        };
        await this.saveWrongRecord(updatedRecord);
      } catch (error) {
        console.error("记录对题失败:", error);
      }
    },
    formatContributionSummary(record) {
      const contributions = record.testContributions || {};
      const entries = Object.entries(contributions)
        .map(([testNo, count]) => ({ testNo: Number(testNo), count: Number(count) }))
        .filter((item) => Number.isInteger(item.testNo) && item.testNo > 0 && item.count > 0)
        .sort((a, b) => a.testNo - b.testNo);

      if (entries.length === 0) {
        return "无";
      }

      return entries.map((item) => `第${item.testNo}次 +${item.count}`).join("，");
    },
    getWrongCountTagClass(wrongCount) {
      const count = Number(wrongCount || 0);
      if (count <= 1) {
        return "wrongbook-tag-wrong-1";
      }
      if (count === 2) {
        return "wrongbook-tag-wrong-2";
      }
      if (count === 3) {
        return "wrongbook-tag-wrong-3";
      }
      return "wrongbook-tag-wrong-3plus";
    },
  },
};
</script>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.25rem;
  font-family: "Microsoft Yahei UI", Arial, sans-serif;
  color: var(--text-color);
  transition: max-width 0.24s ease, padding 0.24s ease;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease;
}

.page-fade-enter,
.page-fade-leave-to {
  opacity: 0;
}

.container.wrongbook-layout {
  max-width: 1180px;
}

.progress-bar-container {
  width: 100%;
  background-color: #e0e0e0;
  border-radius: 0.3125rem;
  overflow: hidden;
  margin: 1rem 0;
  position: relative;
  text-align: center;
}

.progress-bar {
  height: 1rem;
  background-color: var(--primary-color);
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.875rem;
  color: var(--text-color);
  font-weight: bold;
  z-index: 1;
}

h1 {
  text-align: center;
  color: var(--text-color);
  margin-bottom: 1.25rem;
}

h2 {
  text-align: center;
  color: var(--secondary-color);
  margin-bottom: 1rem;
}

.list-item {
  list-style-type: none;
  list-style-position: outside;
}

.list-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}

.list-button {
  background-color: #ffffff;
  color: var(--text-color);
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.list-button:hover {
  background-color: var(--primary-color);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

.upload-container {
  margin-top: 1rem;
  text-align: center;
}

.upload-button {
  background-color: #ffffff;
  color: var(--text-color);
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.upload-button:hover {
  background-color: var(--primary-color);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

.test-container {
  text-align: center;
}

.input-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.hint {
  font-size: 1.25rem;
  font-weight: bold;
  margin-right: 0.5rem;
  color: var(--secondary-color);
}

.input-box {
  width: 50%;
  padding: 0.625rem;
  font-size: 1rem;
  border: 0.0625rem solid var(--border-color);
  border-radius: 0.3125rem;
}

.submit-button {
  background-color: #ffffff;
  color: var(--text-color);
  width: 6rem;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.submit-button:hover {
  background-color: var(--primary-color);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

.feedback {
  margin-top: 1rem;
  font-size: 1.125rem;
}

.correct {
  color: green;
}

.incorrect {
  color: red;
}

.slip {
  color: orange;
}

.mark-incorrect-button {
  background-color: #ffffff;
  color: var(--text-color);
  border: none;
  padding: 0.3125rem 0.625rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  margin-left: 0.625rem;
  transition: transform 0.3s, box-shadow 0.3s;
}

.mark-incorrect-button:hover {
  background-color: #ff4d4f;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

.completion-panel {
  margin-top: 1rem;
  border: 0.0625rem solid var(--border-color);
  border-radius: 0.75rem;
  padding: 1rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.08) 100%);
  backdrop-filter: blur(0.125rem);
}

.score-card {
  text-align: center;
  padding: 1rem 0.75rem;
  border-radius: 0.625rem;
  background-color: rgba(255, 255, 255, 0.55);
  border: 0.0625rem solid rgba(0, 0, 0, 0.05);
}

.score-label {
  margin: 0;
  font-size: 0.95rem;
  opacity: 0.8;
}

.score-value {
  margin: 0.25rem 0 0;
  font-size: 2rem;
  font-weight: 700;
  color: #0f766e;
}

.score-meta {
  margin: 0.35rem 0 0;
  font-size: 0.95rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.875rem;
}

.stat-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 0.625rem;
  padding: 0.6rem 0.75rem;
  font-weight: 600;
}

.stat-pill-correct {
  background-color: rgba(22, 163, 74, 0.14);
  border: 0.0625rem solid rgba(22, 163, 74, 0.28);
}

.stat-pill-incorrect {
  background-color: rgba(239, 68, 68, 0.13);
  border: 0.0625rem solid rgba(239, 68, 68, 0.3);
}

.stat-pill-title {
  font-size: 0.95rem;
}

.stat-pill-value {
  font-size: 1.15rem;
}

.results-container {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.9rem;
}

.result-detail {
  border: 0.0625rem solid var(--border-color);
  border-radius: 0.625rem;
  padding: 0.6rem 0.75rem;
  background-color: rgba(255, 255, 255, 0.6);
}

.result-detail summary {
  cursor: pointer;
  font-weight: 700;
  margin-bottom: 0.4rem;
}

.incorrect-detail {
  border-left: 0.25rem solid #ef4444;
}

.correct-detail {
  border-left: 0.25rem solid #16a34a;
}

.result-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 16rem;
  overflow-y: auto;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.45rem 0;
  border-bottom: 0.0625rem dashed rgba(148, 163, 184, 0.45);
}

.result-item:last-child {
  border-bottom: none;
}

.result-word {
  font-weight: 700;
}

.result-definition {
  font-size: 0.9rem;
  opacity: 0.85;
  word-break: break-word;
}

.result-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.wrongbook-page {
  border: 0.0625rem solid var(--border-color);
  border-radius: 0.75rem;
  padding: 1.1rem 1.2rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.1) 100%);
  max-height: 78vh;
  display: flex;
  flex-direction: column;
}

.wrongbook-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.wrongbook-page-actions {
  display: flex;
  gap: 0.5rem;
}

.wrongbook-page-actions .download-button,
.wrongbook-page-actions .reset-button {
  height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding-top: 0;
  padding-bottom: 0;
}

.wrongbook-filter-bar {
  margin-top: 0.75rem;
  display: grid;
  grid-template-columns: 1.2fr 1.8fr;
  gap: 0.5rem;
  align-items: center;
}

.wrongbook-filter-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.wrongbook-level-buttons {
  display: inline-flex;
  border-radius: 0.625rem;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.9); 
  border: 0.0625rem solid var(--border-color);
}

.wrongbook-level-button {
  border: none;
  border-right: 0.0625rem solid var(--border-color);
  transition: none;
  background-color: transparent;
  color: #334155;
  border-radius: 0;
  min-width: 2.2rem;
  padding: 0 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.wrongbook-level-button:last-child {
  border-right: none;
}

.wrongbook-level-button:hover {
  background-color: rgba(255, 255, 255, 0.75);
}

.wrongbook-level-button.active {
  background-color: var(--primary-color);
  color: var(--text-color);
}

.wrongbook-filter-input {
  border: 0.0625rem solid var(--border-color);
  border-radius: 0.25rem;
  padding: 0 0.5rem;
  font-size: 0.95rem;
  height: 2.25rem;
  box-sizing: border-box;
}

.wrongbook-entry-button {
  margin-left: 0.5rem;
}

.wrongbook-controls {
  margin-top: 1rem;
  border: 0.0625rem solid var(--border-color);
  border-radius: 0.625rem;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.wrongbook-message {
  margin: 0;
  width: 100%;
  text-align: center;
  font-size: 0.9rem;
  opacity: 0.88;
}

.wrongbook-panel {
  margin-top: 1rem;
  border: 0.0625rem solid var(--border-color);
  border-radius: 0.625rem;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.5);
}

.wrongbook-panel summary {
  cursor: pointer;
  font-weight: 700;
}

.wrongbook-stats {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.wrongbook-stat-card {
  border: 0.0625rem solid var(--border-color);
  border-radius: 0.5rem;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  background-color: rgba(255, 255, 255, 0.55);
}

.wrongbook-stat-label {
  font-size: 0.85rem;
  opacity: 0.8;
}

.wrongbook-stat-value {
  font-size: 1.2rem;
  font-weight: 700;
}

.wrongbook-delete-tools {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.wrongbook-select,
.wrongbook-input {
  border: 0.0625rem solid var(--border-color);
  border-radius: 0.25rem;
  padding: 0 0.5rem;
  font-size: 0.95rem;
  height: 2.25rem;
  box-sizing: border-box;
}

.wrongbook-list {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  flex: 1;
  min-height: 0;
  max-height: none;
  overflow-y: auto;
}

.wrongbook-item {
  padding: 0.45rem 0;
  border-bottom: 0.0625rem dashed rgba(148, 163, 184, 0.45);
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.wrongbook-item:last-child {
  border-bottom: none;
}

.wrongbook-item-main {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
}

.wrongbook-word {
  font-weight: 700;
}

.wrongbook-tag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.wrongbook-tag-left {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.wrongbook-tag {
  display: inline-flex;
  align-items: center;
  border: 0.0625rem solid rgba(148, 163, 184, 0.45);
  border-radius: 999px;
  padding: 0.15rem 0.55rem;
  font-size: 0.82rem;
  background-color: rgba(255, 255, 255, 0.85);
}

.wrongbook-tag-wrong-1 {
  background-color: rgba(34, 197, 94, 0.16);
  border-color: rgba(22, 163, 74, 0.35);
  color: #166534;
}

.wrongbook-tag-wrong-2 {
  background-color: rgba(250, 204, 21, 0.2);
  border-color: rgba(202, 138, 4, 0.35);
  color: #854d0e;
}

.wrongbook-tag-wrong-3 {
  background-color: rgba(251, 146, 60, 0.2);
  border-color: rgba(234, 88, 12, 0.35);
  color: #9a3412;
}

.wrongbook-tag-wrong-3plus {
  background-color: rgba(239, 68, 68, 0.16);
  border-color: rgba(220, 38, 38, 0.4);
  color: #b91c1c;
}

.wrongbook-delete-inline {
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding-top: 0;
  padding-bottom: 0;
}

.wrongbook-empty {
  margin-top: 0.75rem;
  opacity: 0.8;
}

.result-action-button {
  min-width: 11rem;
}

.download-button,
.reset-button {
  background-color: #ffffff;
  color: var(--text-color);
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.download-button:hover,
.reset-button:hover {
  background-color: var(--primary-color);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

/* Unified button theme: white by default, selected states use primary color */
.container button {
  background-color: #ffffff;
  color: var(--text-color);
  border: 0.0625rem solid var(--border-color);
  transform: none;
}

.container button:hover {
  background-color: #ffffff;
  transform: none;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.08);
}

.container button:active {
  transform: none;
}


.wrongbook-level-button.active {
  background-color: var(--primary-color);
  color: var(--text-color);
  border-color: var(--primary-color);
}

.test-option-button.active:hover,
.wrongbook-level-button.active:hover {
  color: var(--text-color);
  border-color: var(--primary-color);
}



@media (max-width: 768px) {
  .results-container {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .result-action-button {
    width: 100%;
  }

  .wrongbook-delete-tools {
    flex-direction: column;
    align-items: stretch;
  }

  .wrongbook-stats {
    grid-template-columns: 1fr;
  }

  .wrongbook-filter-bar {
    grid-template-columns: 1fr;
  }

  .wrongbook-filter-right {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .wrongbook-entry-button {
    margin-left: 0;
    margin-top: 0.5rem;
  }
}

.advanced-settings {
  margin-top: 1rem;
  text-align: center;
}

.exit-button {
  display: block;
  margin: 1rem auto;
  width: 6rem;
  background-color: #ffffff;
  color: var(--text-color);
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.exit-button:hover {
  background-color: #ff4d4f;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

.batch-test-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.batch-test-button {
  background-color: #ffffff;
  color: var(--text-color);
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.batch-test-button:hover {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

.batch-test-button:disabled {
  background-color: var(--border-color);
  color: var(--text-color);
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
  cursor: not-allowed;
}

.print-button {
  background-color: #ffffff;
  color: var(--text-color);
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  margin-top: 1rem;
  transition: transform 0.3s, box-shadow 0.3s;
}

.print-button:hover {
  background-color: var(--primary-color);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

.book-grid, .unit-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
}

.book-card, .unit-card {
  background-color: #ffffff;
  color: var(--text-color);
  padding: 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: center;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.book-card:hover, .unit-card:hover {
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
}

.book-card.selected, .unit-card.selected {
  background-color: var(--primary-color);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.2);
}

.start-test-container {
  text-align: center;
  margin-top: 1rem;
}

.start-test-button {
  background-color: var(--primary-color);
  color: var(--text-color);
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.start-test-button:hover {
  background-color: var(--hover-color);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
}

.start-test-button:disabled {
  background-color: var(--border-color);
  color: var(--text-color);
  cursor: not-allowed;
  opacity: 0.6;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.preset-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.3s, transform 0.2s;
}

.preset-card:hover {
  background-color: var(--hover-color);
}

.active-card {
  border: 2px solid var(--primary-color);
}

.unit-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-top: 1rem;
}

.unit-card {
  background-color: var(--secondary-background-color);
  color: var(--text-color);
  padding: 0.5rem;
  border-radius: 0.25rem;
  text-align: center;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.3s, transform 0.2s;
}

.unit-card:hover {
  background-color: var(--hover-color);
}

.unit-card.active-card {
  border: 2px solid var(--primary-color);
}

.start-test-container {
  text-align: center;
  margin-top: 1rem;
}

.start-test-button {
  background-color: #ffffff;
  color: var(--text-color);
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.start-test-button:hover {
  background-color: var(--primary-color);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
}

.test-count-label {
  font-size: 1rem;
  margin-right: 0.5rem;
}

.test-count-input {
  padding: 0.5rem;
  font-size: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  margin-bottom: 0.5rem;
  width: 5rem;
  text-align: center;
}

.error-message {
  color: red;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.preset-title {
  font-size: 1rem;
  font-weight: bold;
  text-align: center;
}

.test-options {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.test-option-button {
  background-color: #ffffff;
  color: var(--text-color);
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-weight: bold;
  margin: 0 0.5rem;
  transition: transform 0.3s, box-shadow 0.3s;
}

.test-option-button:disabled {
  background-color: var(--border-color) !important; 
  color: var(--text-color);
  cursor: not-allowed;
  opacity: 0.6;
  border: none !important;
}

.test-option-button.active {
  border: 2px solid var(--primary-color);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.2);
}




.custom-test-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.test-count-label {
  font-size: 1rem;
  margin-right: 0.5rem;
}

.test-count-input {
  padding: 0.5rem;
  font-size: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  width: 5rem;
  text-align: center;
}

.test-count-hint {
  font-size: 0.875rem;
  margin-left: 0.5rem;
  color: var(--text-color);
}

.test-count-hint.error {
  color: red;
}

.custom-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  cursor: default;
}

.upload-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

/* 修改 upload-small-card 和 upload-status-card 样式以与 unit-card 保持一致 */
.upload-small-card, .upload-status-card {
  background-color: var(--secondary-background-color);
  color: var(--text-color);
  padding: 0.5rem;
  border-radius: 0.25rem;
  text-align: center;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.3s, transform 0.2s;
}

.upload-small-card:hover, .upload-status-card:hover {
  background-color: var(--hover-color);
}

.upload-small-card {
  border: 1px solid var(--border-color);
}

.upload-status-card {
  border: 1px solid var(--primary-color);
}

</style>