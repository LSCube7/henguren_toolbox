var highlightedWord = null;
var definitions = null;

function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

async function processText() {
  var inputText = document.getElementById("textInput").value;
  var outputDiv = document.getElementById("output");
  var highlightedWordsTextArea = document.getElementById("highlightedWords");
  var wordCountTextArea = document.getElementById("wordCount");


  // 将输入文本中的实词用高亮标记输出
  var wordCount = 0; // 初始化实词计数器


  await loadDefinitions(); // Wait for loading definitions before processing text

  var wordList = Object.keys(definitions); // Get list of words from loaded definitions

  clearDefinitions();

  outputDiv.innerHTML = inputText.replace(new RegExp('(' + wordList.join('|') + ')', 'g'), '<span class="highlight" onmouseover="showDefinitions(event)" onmouseout="clearDefinitions()">$1<span class="definition"></span></span>');

  var highlightedWords = [];
  wordList.forEach(function(word) {
      if (inputText.indexOf(word) !== -1) {
          highlightedWords.push(word);
      }

  });
  wordCount = highlightedWords.length;
  highlightedWordsTextArea.value = highlightedWords.join(" ");
  wordCountTextArea.value = "共含有实词 " + wordCount + " 个";
}

async function loadDefinitions() {
  try {
      var response = await fetch('definitions.json');
      definitions = await response.json();
  } catch (error) {
      console.error('Error loading definitions:', error);
  }
}

function showDefinitions(event) {
  var highlightedText = event.target.textContent.trim();
  var definitionSpan = event.target.querySelector('.definition');

  if (!definitionSpan || highlightedText === highlightedWord) return;

  clearDefinitions();

  highlightedWord = highlightedText;

  var wordDefinitions = definitions[highlightedText];
  if (wordDefinitions && wordDefinitions.length > 0) {
      var definitionsList = document.createElement('ul');
      wordDefinitions.forEach(function(definition) {
          var listItem = document.createElement('li');
          listItem.textContent = definition;
          definitionsList.appendChild(listItem);
      });
      definitionSpan.appendChild(definitionsList);
      definitionSpan.style.display = 'block';
  }
}

function clearDefinitions() {
  var definitionSpans = document.querySelectorAll('.definition');
  definitionSpans.forEach(function(span) {
      span.textContent = '';
      span.style.display = 'none';
  });
  highlightedWord = null;
}



function handleKeyDown(event) {
  if (event.ctrlKey && event.keyCode === 13) {
    processText();
  }


}
