        // 读取 contents.json 文件
        fetch('../wenchang/contents.json')
            .then(response => response.json())
            .then(data => {
                // 生成文章表格
                data.article.forEach(article => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${article.name}</td>
                        <td class="content-link">${article.author}</td>
                        <td>${article.origin}</td>
                        <td>${article.grade}</td>
                        <td>${article.style || ''}</td>
                    `;
                    document.getElementById('articleTable').getElementsByTagName('tbody')[0].appendChild(row);
                });
    
                // 生成诗歌表格
                data.poem.forEach(poem => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${poem.name}</td>
                        <td class="content-link">${poem.author}</td>
                        <td>${poem.origin}</td>
                        <td>${poem.grade}</td>
                        <td>${poem.style || ''}</td>
                `;
                    document.getElementById('poemTable').getElementsByTagName('tbody')[0].appendChild(row);
                });
            })
            .catch(error => console.error('Error:', error));