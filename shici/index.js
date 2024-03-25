function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}
function processText() {
var inputText = document.getElementById("textInput").value;
var outputDiv = document.getElementById("output");
var highlightedWordsTextArea = document.getElementById("highlightedWords");
var wordCountTextArea = document.getElementById("wordCount");

var wordList = ["比", "鄙", "兵", "病", "乘", "持", "从", "达", "当", "道", "得", "尔", "伐", "犯", "方", "负", "赋", "更", "苟", "故", "顾", "观", "归", "过", "好", "号", "还", "会", "惠", "及", "极", "计", "济", "假", "间", "简", "见", "竭", "尽", "进", "居", "举", "具", "俱", "聚", "遽", "决", "绝", "类", "临", "虑", "论", "漫", "明", "名", "命", "难", "平", "戚", "强", "窃", "请", "穷", "求", "取", "去", "全", "任", "入", "若", "善", "少", "舍", "涉", "生", "胜", "师", "施", "实", "食", "使", "释", "市", "恃", "数", "属", "说", "素", "汤", "徒", "亡", "为", "委", "务", "鲜", "向", "效", "谢", "信", "行", "形", "兴", "修", "徐", "许", "寻", "业", "遗", "贻", "夷", "异", "易", "诣", "益", "阴", "引", "盈", "余", "狱", "御", "缘", "远", "云", "章", "知", "止", "志", "致", "质", "专", "走", "足", "卒", "作", "坐", "卑鄙", "布衣", "菲薄", "其实", "亲戚", "驱驰", "无论", "牺牲", "鸿儒", "白丁", "阡陌", "交通", "问津", "绝境", "妻子"];

// 将输入文本中的实词用高亮标记输出
outputDiv.innerHTML = inputText.replace(new RegExp('(' + wordList.join('|') + ')', 'g'), '<span class="highlight">$1</span>');

var wordCount = 0; // 初始化实词计数器
var highlightedWords = [];

wordList.forEach(function(word) {
        if (inputText.indexOf(word) !== -1) {
            highlightedWords.push(word);
        }
    });

// 将实词列表和实词计数显示在对应的文本框中
wordCount = highlightedWords.length
highlightedWordsTextArea.value = highlightedWords.join(' ');
wordCountTextArea.value = "共含有实词 " + wordCount + " 个";
}
function handleKeyDown(event) {
if (event.ctrlKey && event.keyCode === 13) {
    processText();
}
}