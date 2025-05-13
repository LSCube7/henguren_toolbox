<template>
  <div class="container">
    <h1>单词测试器</h1>
    <div v-if="!isTesting">
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
              :key="index" 
              class="unit-card"
              :class="{ 'active-card': selectedFiles.includes(file.name) }"
              @click="toggleFileSelection(file.name)"
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

    <div v-else-if="currentWordIndex < shuffledWords.length">
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
          <input v-model="userInput" placeholder="输入单词" class="input-box" @keydown.enter.prevent="checkAnswer" />
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
    <div v-else>
      <h2>测试完成</h2>
      <p class="result">正确率: {{ correctRate }}% ({{ correctCount }} / {{ shuffledWords.length }})</p>
      <div class="results-container">
        <details open>
          <summary>错误单词 ({{ incorrectWords.length }})</summary>
          <ul>
            <li v-for="word in incorrectWords" :key="word.word">{{ word.word }} - {{ word.en_definition.join("; ") }}
            </li>
          </ul>
        </details>
        <details>
          <summary>正确单词 ({{ correctWords.length }})</summary>
          <ul>
            <li v-for="word in correctWords" :key="word.word">{{ word.word }}</li>
          </ul>
        </details>
      </div>
      <button @click="downloadIncorrectWords" class="download-button">下载错误单词 JSON</button>
      <button @click="resetTest" class="reset-button">重新开始</button>
    </div>
  </div>
</template>

<script>
import listData from "./assets/js/vocabulary/list.json";

export default {
  data() {
    return {
      books: [
        { name: "R2", title: "必修二" },
        { name: "R3", title: "必修三" },
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
    };
  },
  computed: {
    correctRate() {
      return ((this.correctCount / this.shuffledWords.length) * 100).toFixed(2);
    },
    progressPercentage() {
      return ((this.currentWordIndex / this.shuffledWords.length) * 100).toFixed(2);
    },
  },
  created() {
    this.wordLists = listData;
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
  methods: {
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
        word.en_definition.map((definition) => ({
          word: word.word,
          en_definition: [definition],
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
    },
    async startBatchTest() {
      const allWords = [];

      for (const unitName of this.selectedUnits) {
        try {
          // 动态加载单元的 JSON 文件
          const listModule = await import(`./assets/js/vocabulary/${unitName}.json`);
          const words = listModule.vocabulary.flatMap((word) =>
            word.en_definition.map((definition) => ({
              word: word.word,
              en_definition: [definition],
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
    },
    shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    },
    checkAnswer() {
      const currentWord = this.shuffledWords[this.currentWordIndex];
      const correctAnswer = currentWord.word.toLowerCase();
      const userAnswer = this.userInput.trim().toLowerCase();

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
        this.feedback = {
          correct: false,
          slip: true,
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
    markSlipAsIncorrect() {
      const currentWord = this.shuffledWords[this.currentWordIndex - 1];
      this.incorrectWords.push(currentWord);
      this.feedback = {
        correct: false,
        message: `错误！正确答案是: ${currentWord.word}`,
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
    toggleFileSelection(fileName) {
      if (this.selectedFiles.includes(fileName)) {
        this.selectedFiles = this.selectedFiles.filter((file) => file !== fileName);
      } else {
        this.selectedFiles.push(fileName);
      }
    },
    uploadCustomList(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const customList = JSON.parse(e.target.result);
            if (!customList.vocabulary || !Array.isArray(customList.vocabulary)) {
              throw new Error("文件格式不正确，缺少 'vocabulary' 数组");
            }
            this.uploadedFiles.push({ name: file.name, content: customList });
            this.selectedFiles.push(file.name); // 默认选中上传的文件
          } catch (error) {
            alert("上传的文件格式不正确！请确保文件包含 'vocabulary' 数组。");
          }
        };
        reader.readAsText(file);
      }
    },
    startCustomTest() {
      if (this.selectedFiles.length > 0) {
        this.words = this.selectedFiles.flatMap((fileName) => {
          const file = this.uploadedFiles.find((f) => f.name === fileName);
          return file ? file.content.vocabulary.map((word) => ({
            word: word.word,
            en_definition: word.en_definition || [],
          })) : [];
        });
        this.shuffledWords = this.shuffleArray([...this.words]);
        this.isTesting = true;
        this.currentWordIndex = 0;
        this.correctCount = 0;
        this.feedback = null;
        this.userInput = "";
        this.incorrectWords = [];
        this.correctWords = [];
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
    },
    generatePrintableTest() {
      const currentDate = new Date().toLocaleString(); // 获取当前时间
      const sourceInfo = this.selectedList ? `来源：${this.selectedList}` : `来源：${this.selectedLists}`; // 动态来源信息
      // 构建打印版的 HTML 内容
      const printableContent = `
      <html>
        <head>
          <title>测试打印版</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
            }
            h1 {
              text-align: center;
              color: #333;
            }
            .word-list, .answer-list {
              margin-top: 20px;
            }
            .answer-item {
              margin-bottom: 10px;
              white-space: normal; /* 防止换行 */
            }
            .word-item {
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <h1>单词测试打印版</h1>
          <div class="word-list">
                        ${this.shuffledWords
          .map(
            (word, index) => `
                  <div class="word-item">
                     ${index + 1}. &nbsp;&nbsp; ${this.showHint ? `<span class="hint">${word.word[0]}</span>`
                : ""
              }________  ${word.en_definition.join("; ")}
                  </div>
                `
          )
          .join("")}
          </div>
          <div class="answer-list">
            <h2>答案</h2>
            <div class="answer-item">
              ${this.shuffledWords
                .map((word, index) => `${index + 1}. ${word.word}`)
                .join(" &nbsp;&nbsp; ")} <!-- 使用空格分隔答案 -->
            </div>
          </div>
          <div class="footer">
            <p>${sourceInfo}</p>
            <p>生成时间：${currentDate}</p>
          </div>
        </body>
      </html>
    `;

      // 打开新窗口并写入内容
      const printWindow = window.open("", "_blank");
      printWindow.document.open();
      printWindow.document.write(printableContent);
      printWindow.document.close();

      // 调用打印功能
      printWindow.print();
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
            word.en_definition.map((definition) => ({
              word: word.word,
              en_definition: [definition],
            }))
          );
          allWords.push(...words);
        } catch (error) {
          console.error(`无法加载单元 ${unitName} 的数据:`, error);
        }
      }

      // 加载选中的自定义文件单词
      for (const fileName of this.selectedFiles) {
        const file = this.uploadedFiles.find((f) => f.name === fileName);
        if (file) {
          // 每个en_definition分开测试
          const words = file.content.vocabulary.flatMap((word) =>
            word.en_definition.map((definition) => ({
              word: word.word,
              en_definition: [definition],
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
      } else {
        alert("请先选择单词列表或上传自定义单词列表！");
      }
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
  background-color: var(--primary-color);
  color: var(--text-color);
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.list-button:hover {
  background-color: var(--hover-color);
  transform: scale(1.05);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

.upload-container {
  margin-top: 1rem;
  text-align: center;
}

.upload-button {
  background-color: var(--primary-color);
  color: var(--text-color);
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.upload-button:hover {
  background-color: var(--hover-color);
  transform: scale(1.05);
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
  background-color: var(--primary-color);
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
  background-color: var(--hover-color);
  transform: scale(1.05);
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
  background-color: #ff4d4f;
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
  background-color: #ff7875;
  transform: scale(1.05);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

.result {
  text-align: center;
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.reset-button {
  display: block;
  margin: 0 auto;
  background-color: var(--primary-color);
  color: var(--text-color);
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.reset-button:hover {
  background-color: var(--hover-color);
  transform: scale(1.05);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

.advanced-settings {
  margin-top: 1rem;
  text-align: center;
}

.exit-button {
  display: block;
  margin: 1rem auto;
  width: 6rem;
  background-color: #ff4d4f;
  color: var(--text-color);
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.exit-button:hover {
  background-color: #ff7875;
  transform: scale(1.05);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

.batch-test-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.batch-test-button {
  background-color: var(--primary-color);
  color: var(--text-color);
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.batch-test-button:hover {
  background-color: var(--hover-color);
  transform: scale(1.05);
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
  background-color: var(--primary-color);
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
  background-color: var(--hover-color);
  transform: scale(1.05);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

.book-grid, .unit-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
}

.book-card, .unit-card {
  background-color: var(--primary-color);
  color: var(--text-color);
  padding: 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: center;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.book-card:hover, .unit-card:hover {
  transform: scale(1.05);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
}

.book-card.selected, .unit-card.selected {
  background-color: var(--hover-color);
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
  transform: scale(1.05);
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
  transform: scale(1.05);
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
  transform: scale(1.05);
}

.unit-card.active-card {
  border: 2px solid var(--primary-color);
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
  transform: scale(1.05);
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
  background-color: var(--primary-color);
  color: var(--text-color);
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-weight: bold;
  margin: 0 0.5rem;
  transition: transform 0.3s, box-shadow 0.3s;
}

.test-option-button.active {
  background-color: var(--hover-color);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.2);
}

.test-option-button:disabled {
  background-color: var(--border-color);
  color: var(--text-color);
  cursor: not-allowed;
  opacity: 0.6;
}

.test-option-button:hover:enabled {
  transform: scale(1.05);
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
  transform: scale(1.05);
}

.upload-small-card {
  border: 1px solid var(--border-color);
}

.upload-status-card {
  border: 1px solid var(--primary-color);
}

</style>