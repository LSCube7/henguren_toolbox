<template>
    <div class="license-header">
      <h1>许可证</h1>
    </div>
    <div class="license-content">
      <pre>{{ licenseText }}</pre>
    </div>
</template>

<script>
export default {
  data() {
    return {
      licenseText: `MIT License

Copyright (c) 2024-2025 小方盒LSCube

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
    };
  },
  methods: {
  }
};
</script>

<style scoped>

.license-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.license-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text-color);
  align-items: center;
  font-family: "Microsoft YaHei UI", Arial, sans-serif;
}

.back-button {
  padding: 0.5rem 1rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

.back-button:hover {
  background-color: var(--hover-color);
}

.license-content {
  white-space: pre-wrap;
  font-size: 0.9rem;
  color: var(--text-color);
  line-height: 1.5;
  font-family: "Microsoft YaHei UI", Arial, sans-serif;
}
</style>