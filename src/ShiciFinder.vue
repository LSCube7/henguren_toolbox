<template>
  <div class="container">
    <h1>寻找实词</h1>
    <label for="textInput">输入古文：</label><br />
    <textarea id="textInput" placeholder="请输入一段古文" v-model="inputText" @input="autoResize" autofocus @keydown.ctrl.enter.prevent="processText"></textarea>
    <br />
    <button @click="processText">开始寻找（Ctrl+Enter）</button>
    <br />
    <label for="output">古文输出：</label><br />
    <div id="output" v-html="highlightedText"></div>
    <br />
    <label for="highlightedWords">含有的实词：</label><br />
    <textarea id="highlightedWords" class="highlighted-words" v-model="highlightedWords" readonly></textarea>
    <br />
    <label for="wordCount">统计信息：</label><br />
    <textarea id="wordCount" class="wordCount" v-model="wordCountInfo" readonly></textarea>
    <br />
    <button @click="copyDefinitions">复制义项（LaTeX格式）</button>
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
      let latexLines = [];

      this.highlightedText = inputText.replace(new RegExp('(' + wordList.join('|') + ')', 'g'), match => {
        if (definitions[match]) {
          highlightedWords.push(match);
          latexLines.push(`\\text{${match}} & : \\text{${definitions[match].join('; ')}} \\\\`);
          return `<span class="highlight">${match}<span class="definition">${definitions[match].join('\n ')}</span></span>`;
        }
        return match;
      });

      this.highlightedWords = highlightedWords.join(' ');
      this.wordCountInfo = `共含有实词 ${highlightedWords.length} 个`;
      this.latexContent = `\\begin{align*}\n${latexLines.join('\n')}\n\\end{align*}`;
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
        definitionSpan.style.left = `${mouseX + 64}px`;
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
    copyDefinitions() {
    let latexContent = "";
    // 遍历highlightedWords中的每个词条和它的定义，转换为LaTeX格式
    this.highlightedWords.split(' ').forEach(word => {
      if (definitions[word]) {
        // 开始构建每个实词的LaTeX表示
        latexContent += `${word}\\left\\{\\begin{matrix}\n`;
        // 将每个定义添加为矩阵的一行，确保特殊字符被正确转义
        definitions[word].forEach((def, index) => {
          def = def.replace(/&/g, '\\&'); // 转义特殊字符&
          latexContent += def;
          if (index < definitions[word].length - 1) {
            latexContent += " \\\\\n"; // 不是最后一项则添加换行
          }
        });
        // 结束这个实词的LaTeX表示
        latexContent += `\\end{matrix}\\right.\n`;
      }
    });

    // 使用 Clipboard API 复制到剪贴板
    navigator.clipboard.writeText(latexContent).then(() => {
      alert('义项已复制到剪贴板');
    }).catch(err => {
      console.error('无法复制到剪贴板', err);
      alert('复制失败，请检查浏览器权限设置。');
    });
  }
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
  min-height: 6.25rem;
  resize: none;
  margin-bottom: 1.25rem;
  padding: 0.9375rem;
  border: 0.0625rem solid var(--border-color);
  border-radius: 0.3125rem;
  box-sizing: border-box;
  font-size: 1rem;
  font-family: "Microsoft Yahei UI", Arial, sans-serif;
  overflow: hidden;
}

button {
  display: block;
  width: 100%;
  padding: 0.9375rem;
  border: none;
  background-color: var(--primary-color);
  color: #fff;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-size: 1.125rem;
  font-weight: bold;
  
  transition: transform 0.3s, box-shadow 0.3s;
}

button:hover {
  background-color: var(--hover-color);
  transform: scale(1.005);
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
}

#output {
  width: 100%;
  min-height: 6.25rem;
  border: 0.0625rem solid var(--border-color);
  padding: 0.9375rem;
  margin-bottom: 1.25rem;
  border-radius: 0.3125rem;
  box-sizing: border-box;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  font-size: 1rem;
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
  border: 0.0625rem solid var(--border-color);
  padding: 0.3125rem;
  border-radius: 0.3125rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
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
  min-height: 1.25rem;
  border: 0.0625rem solid var(--border-color);
  padding: 0.9375rem;
  margin-bottom: 1.25rem;
  border-radius: 0.3125rem;
  box-sizing: border-box;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  font-size: 1rem;
  font-family: "Microsoft Yahei UI", Arial, sans-serif;
}
</style>
