<template>
  <div class="container">
    <h1>寻找实词</h1>
    <label for="textInput">输入古文：</label><br />
    <textarea id="textInput" placeholder="请输入一段古文" v-model="inputText" @input="autoResize" autofocus
      @keydown.ctrl.enter.prevent="processText"></textarea>
    <br />
    <button @click="processText">开始寻找（Ctrl+Enter）</button>
    <br />
    <label for="output">古文输出：</label><br />
    <div id="output" v-html="highlightedText" @mouseover="showDefinitions" @mouseout="clearDefinitions"></div>

    <br />
    <label for="highlightedWords">含有的实词：</label><br />
    <textarea id="highlightedWords" class="highlighted-words" v-model="highlightedWords" readonly></textarea>
    <br />
    <label for="wordCount">统计信息：</label><br />
    <textarea id="wordCount" class="wordCount" v-model="wordCountInfo" readonly></textarea>
    <br />
  </div>
</template>

<script>
import definitions from '@/assets/js/shici/definitions.json';

export default {
  data() {
    return {
      inputText: '',
      highlightedText: '',
      highlightedWords: '',
      wordCountInfo: '',
      highlightedWord: null,
      definitionDisplay: 'none',
      definitionLeft: '0',
      definitionTop: '0'
    };
  },
  methods: {
    autoResize() {
      const textarea = document.getElementById('textInput');
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    },

    async processText() {
      const wordList = Object.keys(definitions);
      const inputText = this.inputText;
      let highlightedWords = [];
      let uniqueWords = new Set();
      let orderedWords = [];

      this.clearDefinitions();

      // Filter words from the text according to the order in the definitions.json
      for (let word of wordList) {
        if (inputText.includes(word)) {
          orderedWords.push(word);
        }
      }

      this.highlightedText = inputText.replace(new RegExp('(' + orderedWords.join('|') + ')', 'g'), (match) => {
        if (definitions[match]) {
          highlightedWords.push(match);
          uniqueWords.add(match);
          return `<span class="highlight" :style="{ display: definitionDisplay, left: definitionLeft, top: definitionTop }">${match}<span class="definition"></span></span>`;
        }
        return match;
      });

      this.highlightedWords = orderedWords.join(' ');
      this.wordCountInfo = `共含有实词 ${orderedWords.length} 个`;
    },

    showDefinitions(event) {
      const highlightedText = event.target.textContent.trim();
      const definitionSpan = event.target.querySelector('.definition');

      if (!definitionSpan || highlightedText === this.highlightedWord) return;

      this.clearDefinitions();

      this.highlightedWord = highlightedText;

      const wordDefinitions = definitions[highlightedText];

      if (wordDefinitions && wordDefinitions.length > 0) {
        const definitionsList = document.createElement('ul');
        wordDefinitions.forEach((definition) => {
          const listItem = document.createElement('li');
          listItem.textContent = definition;
          definitionsList.appendChild(listItem);
        });
        definitionSpan.appendChild(definitionsList);
        // Calculate the position of the definition box based on the mouse position
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        const offset = 15; // Adjust this value to set the distance between the mouse and the definition box
        definitionSpan.style.position = 'fixed';
        definitionSpan.style.left = `${mouseX}px`;
        definitionSpan.style.top = `${mouseY + offset}px`; // Add an offset to show the definition box below the mouse
        definitionSpan.style.display = 'block';
      }
    },



    clearDefinitions() {
      const definitionSpans = document.querySelectorAll('.definition');
      definitionSpans.forEach((span) => {
        span.textContent = '';
        span.style.display = 'none';
      });
      this.highlightedWord = null;
    },
  },


};
</script>








<style scoped>
h1 {
  text-align: center;
  color: var(--text-color);
}

label {
  font-weight: bold;
  color: var(--text-color);
}

textarea {
  width: 100%;
  min-height: 100px;
  resize: none;
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  box-sizing: border-box;
  font-size: 16px;
  font-family: "Microsoft Yahei UI", Arial, sans-serif;
  overflow: hidden;
}

button {
  display: block;
  width: 100%;
  padding: 15px;
  border: none;
  background-color: var(--primary-color);
  color: #fff;
  border-radius: 5px;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  
  transition: transform 0.3s, box-shadow 0.3s;
}

button:hover {
  background-color: var(--hover-color);
  transform: scale(1.005);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

#output {
  width: 100%;
  min-height: 100px;
  border: 1px solid var(--border-color);
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 5px;
  box-sizing: border-box;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  font-size: 16px;
  font-family: "Microsoft Yahei UI", Arial, sans-serif;
}

:deep(.highlight) {
  color: var(--primary-color);
  font-weight: bold;
}

:deep(.highlight .definition) {
  display: none;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  background-color: #fff;
  border: 1px solid var(--border-color);
  padding: 5px;
  border-radius: 5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  color: var(--primary-color);
  font-size: 100%;
}

:deep(.highlight:hover .definition) {
  display: block;
}

:deep(.highlight:hover) {
  color: var(--hover-color);
}

.highlighted-words {
  color: var(--secondary-color);
  font-weight: bold;
}

.wordCount {
  width: 100%;
  min-height: 20px;
  border: 1px solid var(--border-color);
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 5px;
  box-sizing: border-box;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  font-size: 16px;
  font-family: "Microsoft Yahei UI", Arial, sans-serif;
}
</style>
