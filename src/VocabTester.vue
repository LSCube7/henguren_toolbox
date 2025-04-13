<template>
  <div class="container">
    <h1>单词测试器</h1>
    <div v-if="!isTesting">
      <h2>选择单词列表</h2>
      <ul class="list-container">
        <li v-for="list in wordLists" :key="list.name" class="list-item">
          <button @click="startTest(list.name)" class="list-button">{{ list.title }}</button>
        </li>
      </ul>
      <div class="upload-container">
        <label for="fileUpload">上传自定义单词列表：</label>
        <input type="file" id="fileUpload" @change="uploadCustomList" class="upload-button"/>
      </div>
    </div>
    <div v-else-if="currentWordIndex < shuffledWords.length">
      <h2>测试中</h2>
      <div class="test-container">
        <p class="definition">英文释义: {{ shuffledWords[currentWordIndex].en_definition.join("; ") }}</p>
        <div class="input-container">
          <span class="hint">{{ shuffledWords[currentWordIndex].word[0] }}</span>
          <input
            v-model="userInput"
            placeholder="输入单词"
            class="input-box"
            @keydown.enter.prevent="checkAnswer"
          />
        </div>
        <button @click="checkAnswer" class="submit-button">提交</button>
        <p v-if="feedback" :class="{ correct: feedback.correct, incorrect: !feedback.correct }" class="feedback">
          {{ feedback.message }}
        </p>
      </div>
    </div>
    <div v-else>
      <h2>测试完成</h2>
      <p class="result">正确率: {{ correctRate }}% ({{ correctCount }} / {{ shuffledWords.length }})</p>
      <div class="results-container">
        <details open>
          <summary>错误单词 ({{ incorrectWords.length }})</summary>
          <ul>
            <li v-for="word in incorrectWords" :key="word.word">{{ word.word }} - {{ word.en_definition.join("; ") }}</li>
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
      wordLists: [],
      selectedList: null,
      words: [],
      shuffledWords: [],
      currentWordIndex: 0,
      userInput: "",
      feedback: null,
      correctCount: 0,
      incorrectWords: [],
      correctWords: [],
      isTesting: false,
    };
  },
  computed: {
    correctRate() {
      return ((this.correctCount / this.shuffledWords.length) * 100).toFixed(2);
    },
  },
  created() {
    this.wordLists = listData;
  },
  methods: {
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
      const isCorrect =
      userAnswer === correctAnswer || userAnswer === correctAnswer.slice(1);

      if (isCorrect) {
      this.correctCount++;
      this.correctWords.push(currentWord);
      this.feedback = { correct: true, message: "正确！" };
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
    uploadCustomList(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const customList = JSON.parse(e.target.result);
            this.words = customList.vocabulary || [];
            this.shuffledWords = this.shuffleArray([...this.words]);
            this.isTesting = true;
            this.currentWordIndex = 0;
            this.correctCount = 0;
            this.feedback = null;
            this.userInput = "";
            this.incorrectWords = [];
            this.correctWords = [];
          } catch (error) {
            alert("上传的文件格式不正确！");
          }
        };
        reader.readAsText(file);
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
  color: #fff;
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
  color: #fff;
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
  color: #fff;
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

.result {
  text-align: center;
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.reset-button {
  display: block;
  margin: 0 auto;
  background-color: var(--primary-color);
  color: #fff;
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
</style>