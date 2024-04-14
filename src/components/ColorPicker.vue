<template>
    <div class="color-picker-dialog-wrapper">
        <!-- 颜色选择弹窗 -->
        <div v-if="showColorPicker" class="color-picker-dialog">

            <!-- 输入框，允许用户设置各种颜色 -->
            <label for="primaryColor">主要颜色：</label>
            <input type="color" id="primaryColor" v-model="selectedColors.primaryColor">
            <label for="secondaryColor">次要颜色：</label>
            <input type="color" id="secondaryColor" v-model="selectedColors.secondaryColor">
            <label for="textColor">文本颜色：</label>
            <input type="color" id="textColor" v-model="selectedColors.textColor">
            <label for="primaryBackgroundColor">主要背景颜色：</label>
            <input type="color" id="primaryBackgroundColor" v-model="selectedColors.primaryBackgroundColor">
            <label for="secondaryBackgroundColor">次要背景颜色：</label>
            <input type="color" id="secondaryBackgroundColor" v-model="selectedColors.secondaryBackgroundColor">
            <label for="borderColor">边框颜色：</label>
            <input type="color" id="borderColor" v-model="selectedColors.borderColor">
            <br>

            <!-- 同样的方式设置其他颜色 -->

            <button @click="applyColors">应用</button>
            <br>
            <button @click="resetColors">恢复默认</button>
            <br>
            <!-- 关闭按钮 -->
            <button @click="closeColorPicker" class="close-button">关闭</button>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        showColorPicker: {
            type: Boolean,
            required: true
        }
    },
    data() {
        return {
            selectedColors: {
                primaryColor: localStorage.getItem('primaryColor') || '#5bcefa', // 初始颜色
                // 其他颜色变量的初始值
                secondaryColor: localStorage.getItem('secondaryColor') || '#f6a8b8',
                textColor: localStorage.getItem('textColor') || '#333',
                primaryBackgroundColor: localStorage.getItem('primaryBackgroundColor') || '#f0f2f5',
                secondaryBackgroundColor: localStorage.getItem('secondaryBackgroundColor') || '#f9f9f9',
                borderColor: localStorage.getItem('borderColor') || '#ccc'
            },
        };
    },
    computed: {
        dynamicStyles() {
            // 构建应用到页面内容的 CSS 变量样式对象
            return {
                '--primary-color': this.selectedColors.primaryColor,
                '--secondary-color': this.selectedColors.secondaryColor,
                '--text-color': this.selectedColors.textColor,
                '--primary-background-color': this.selectedColors.primaryBackgroundColor,
                '--secondary-background-color': this.selectedColors.secondaryBackgroundColor,
                '--border-color': this.selectedColors.borderColor,
                '--hover-color': this.calculateHoverColor(this.selectedColors.primaryColor)
            };
        }
    },
    methods: {
        closeColorPicker() {
            // 关闭颜色选择弹窗
            this.$emit('close');
        },
        applyColors() {
            // 应用用户选择的颜色到页面的 CSS 变量中
            const styles = this.dynamicStyles;
            Object.keys(styles).forEach(key => {
                document.documentElement.style.setProperty(key, styles[key]);
                // 保存颜色到本地存储
                localStorage.setItem(key.replace('--', ''), styles[key]);
            });
            // 关闭颜色选择弹窗
            this.$emit('close', this.selectedColors);
        },
        resetColors() {
            // 恢复默认颜色
            const defaultColors = {
                primaryColor: '#5bcefa',
                secondaryColor: '#f6a8b8',
                textColor: '#333',
                primaryBackgroundColor: '#f0f2f5',
                secondaryBackgroundColor: '#f9f9f9',
                borderColor: '#ccc'
            };
            // 应用默认颜色到页面的 CSS 变量中
            Object.keys(defaultColors).forEach(key => {
                document.documentElement.style.setProperty('--' + key, defaultColors[key]);
                // 更新组件数据
                this.selectedColors[key] = defaultColors[key];
                // 移除本地存储中的颜色
                this.applyColors();
            });
            // 关闭颜色选择弹窗
            this.$emit('close', defaultColors);
        },
        calculateHoverColor(color) {
            // 计算悬停颜色（将主要颜色变暗 10%）
            return this.darkenColor(color, 10);
        },
        darkenColor(color, percent) {
            // 将颜色变暗
            // 将颜色值转换为 HSL
            const hsl = this.hexToHSL(color);
            // 减少亮度值，使得颜色变暗
            hsl[2] -= percent / 100;
            // 将 HSL 转换回十六进制颜色值
            return this.hslToHex(hsl[0], hsl[1], hsl[2]);
        },
        hexToHSL(hex) {
            // 将十六进制颜色值转换为 HSL
            let r = parseInt(hex.slice(1, 3), 16) / 255,
                g = parseInt(hex.slice(3, 5), 16) / 255,
                b = parseInt(hex.slice(5, 7), 16) / 255;

            let max = Math.max(r, g, b),
                min = Math.min(r, g, b);

            let h, s, l = (max + min) / 2;

            if (max === min) {
                h = s = 0; // achromatic
            } else {
                let d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }

                h /= 6;
            }

            return [h, s, l];
        },
        hslToHex(h, s, l) {
            // 将 HSL 颜色值转换为十六进制颜色值
            let r, g, b;

            if (s === 0) {
                r = g = b = l; // achromatic
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                };

                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;

                r = hue2rgb(p, q, h + 1 / 3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1 / 3);
            }

            const toHex = (x) => {
                const hex = Math.round(x * 255).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            };

            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        }
    }
};
</script>

<style scoped>
/* 页面内容样式 */
.content {
    /* 使用 CSS 变量定义颜色 */
    --primary-color: var(--primary-color, #5bcefa);
    --secondary-color: var(--secondary-color, #f6a8b8);
    --text-color: var(--text-color, #333);
    --primary-background-color: var(--primary-background-color, #f0f2f5);
    --secondary-background-color: var(--secondary-background-color, #f9f9f9);
    --border-color: var(--border-color, #ccc);
    --hover-color: var(--hover-color, #4ab3d1);
    /* 悬停颜色 */
}

button {
    padding: 8px 16px;
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
}

button:hover {
    background-color: var(--hover-color);
}

.color-picker-dialog {
    width: 600px;
    max-height: 1000px;
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    justify-content: space-between;

}

.color-picker-dialog-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.5);
}
</style>