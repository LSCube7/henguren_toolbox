<template>
  <div class="container">
    <h1>文学常识</h1>
    <button v-if="isFiltered" @click="clearFilter" class="cancel-button">取消筛选</button>
    <h2>文章</h2>
    <table>
      <thead>
        <tr>
          <th @click="filterByField('name')">名称</th>
          <th @click="filterByField('author')">作者</th>
          <th @click="filterByField('origin')">出处</th>
          <th @click="filterByField('grade')">年级</th>
          <th @click="filterByField('style')">体裁</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="article in filteredArticles" :key="article.name">
          <td @click="filterByField('name', article.name)">{{ article.name }}</td>
          <td @click="filterByField('author', article.author)">{{ article.author }}</td>
          <td @click="filterByField('origin', article.origin)">{{ article.origin }}</td>
          <td @click="filterByField('grade', article.grade)">{{ article.grade }}</td>
          <td @click="filterByField('style', article.style)">{{ article.style || '' }}</td>
        </tr>
      </tbody>
    </table>

    <h2>诗歌</h2>
    <table>
      <thead>
        <tr>
          <th @click="filterByField('name')">名称</th>
          <th @click="filterByField('author')">作者</th>
          <th @click="filterByField('origin')">出处</th>
          <th @click="filterByField('grade')">年级</th>
          <th @click="filterByField('style')">体裁</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="poem in filteredPoems" :key="poem.name">
          <td @click="filterByField('name', poem.name)">{{ poem.name }}</td>
          <td @click="filterByField('author', poem.author)">{{ poem.author }}</td>
          <td @click="filterByField('origin', poem.origin)">{{ poem.origin }}</td>
          <td @click="filterByField('grade', poem.grade)">{{ poem.grade }}</td>
          <td @click="filterByField('style', poem.style)">{{ poem.style || '' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import contents from '@/assets/js/wenchang/contents.json';

export default {
  data() {
    return {
      articles: [],
      poems: [],
      filteredArticles: [],
      filteredPoems: [],
      isFiltered: false,
      filterField: null,
      filterValue: null
    };
  },
  created() {
    this.articles = contents.article;
    this.poems = contents.poem;
    this.filteredArticles = this.articles;
    this.filteredPoems = this.poems;
  },
  methods: {
    clearFilter() {
      this.filteredArticles = this.articles;
      this.filteredPoems = this.poems;
      this.isFiltered = false;
      this.filterField = null;
      this.filterValue = null;
    },
    filterByField(field, value) {
      if (this.filterField === field && this.filterValue === value) {
        this.clearFilter();
      } else {
        if (value) {
          this.filteredArticles = this.articles.filter(article => article[field] === value);
          this.filteredPoems = this.poems.filter(poem => poem[field] === value);
          this.isFiltered = true;
          this.filterField = field;
          this.filterValue = value;
        }
      }
    }
  }
};
</script>

<style scoped>
h1 {
  text-align: center;
  color: #333;
  margin-bottom: 20px;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 30px;
}

th,
td {
  border: 1px solid #5bcefa;
  padding: 12px;
  text-align: center;
}

th {
  background-color: #f6a8b8;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 1px;
}

tr:nth-child(even) {
  background-color: #f2f2f2;
}

tr:hover {
  background-color: #ddd;
}

td:hover {
  color: #5bcefa;
  cursor: pointer;
}

.cancel-button {
  background-color: #5bcefa;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  margin-bottom: 10px;
  cursor: pointer;
  font-weight: bold;
  float: right;
  /* 右对齐 */
}

.cancel-button:hover {
  background-color: #4ab3d1;
  /* hover颜色 */
}

.cancel-button:focus {
  outline: none;
}
</style>
