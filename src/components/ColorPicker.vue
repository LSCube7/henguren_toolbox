<template>
    <div 
        class="color-picker-dialog-wrapper" 
        v-if="showColorPicker" 
        @animationend="handleAnimationEnd"
        :class="{ 'fade-out': isClosing }"
    >
        <!-- 颜色选择弹窗 -->
        <div class="color-picker-dialog">
            <!-- 标题 -->
            <div class="dialog-header">
                <h3>颜色选择器</h3>
                <button @click="closeColorPicker" class="close-button">×</button>
            </div>

            <!-- 颜色预设 -->
            <div class="color-presets">
                <h4>颜色预设</h4>
                <div class="preset-grid">
                    <!-- 预设卡片 -->
                    <div 
                        v-for="preset in colorPresets" 
                        :key="preset.name" 
                        class="preset-card"
                        :class="{ 'active-card': selectedMode === 'preset' && activePreset === preset.name }"
                        @click="selectPreset(preset)"
                    >
                        <div class="preset-title">{{ preset.name }}</div>
                        <div class="preset-colors">
                            <div 
                                v-for="color in preset.colors.filter((_, index) => index !== 3)" 
                                :key="color" 
                                class="preset-color" 
                                :style="{ backgroundColor: color }"
                            ></div>
                        </div>
                    </div>

                    <!-- 自定义颜色卡片 -->
                    <div 
                        class="preset-card custom-card"
                        :class="{ 'active-custom-card': selectedMode === 'custom' }"
                        @click="selectCustomColors"
                    >
                        <div class="preset-title">自定义颜色</div>
                        <div class="preset-colors">
                            <div 
                                v-for="color in filteredCustomColors" 
                                :key="color.key" 
                                class="preset-color" 
                                :style="{ backgroundColor: color.value }"
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 自定义颜色（默认隐藏） -->
            <div class="color-inputs" v-if="showCustomColors">
                <label for="primaryColor">主要颜色：</label>
                <input type="color" id="primaryColor" v-model="customColors.primaryColor">
                <label for="secondaryColor">次要颜色：</label>
                <input type="color" id="secondaryColor" v-model="customColors.secondaryColor">
                <label for="textColor">文本颜色：</label>
                <input type="color" id="textColor" v-model="customColors.textColor">
                <label for="primaryBackgroundColor">主要背景颜色：</label>
                <input type="color" id="backgroundColor" v-model="customColors.BackgroundColor">
                <label for="backgroundColor">背景颜色：</label>
                <input type="color" id="primaryBackgroundColor" v-model="customColors.primaryBackgroundColor">
                <label for="secondaryBackgroundColor">次要背景颜色：</label>
                <input type="color" id="secondaryBackgroundColor" v-model="customColors.secondaryBackgroundColor">
                <label for="borderColor">边框颜色：</label>
                <input type="color" id="borderColor" v-model="customColors.borderColor">
            </div>

            <!-- 按钮 -->
            <div class="dialog-footer" v-if="showCustomColors">
                <button @click="applyColors">应用</button>
                <button @click="resetColors">恢复默认</button>
            </div>
        </div>
    </div>
</template>

<script>
import colorPresets from './colorPresets.json';

export default {
    props: {
        showColorPicker: {
            type: Boolean,
            required: true
        }
    },
    data() {
        const storedCustomColors = JSON.parse(localStorage.getItem('customColors')) || {
            primaryColor: '#5bcefa',
            secondaryColor: '#f6a8b8',
            textColor: '#333333',
            backgroundColor: '#ffffff',
            primaryBackgroundColor: '#f0f2f5',
            secondaryBackgroundColor: '#f9f9f9',
            borderColor: '#cccccc',
            hoverColor: '#4aa3d8' // 默认 hover-color
        };

        return {
            customColors: storedCustomColors,
            selectedMode: localStorage.getItem('selectedMode') || 'preset', // 记忆选择的模式
            activePreset: localStorage.getItem('activePreset') || colorPresets[0]?.name, // 当前选中的预设名称
            isClosing: false,
            showCustomColors: false, // 默认隐藏自定义颜色部分
            colorPresets // 从 JSON 文件加载颜色预设
        };
    },
    computed: {
        filteredCustomColors() {
            // 过滤掉 hoverColor
            return Object.entries(this.customColors)
                .filter(([key]) => key !== 'hoverColor')
                .map(([key, value]) => ({ key, value }));
        },
        dynamicStyles() {
            const colors = this.selectedMode === 'preset'
                ? this.colorPresets.find(preset => preset.name === this.activePreset)?.colors || []
                : Object.values(this.customColors);

            const hoverColor = this.selectedMode === 'preset'
                ? this.calculateHoverColor(colors[0] || '#000000') // 计算预设的 hover-color
                : this.customColors.hoverColor || this.calculateHoverColor(this.customColors.primaryColor);

            return {
                '--primary-color': colors[0] || '#000000',
                '--secondary-color': colors[1] || '#000000',
                '--text-color': colors[2] || '#000000',
                '--background-color': colors[3] || '#000000',
                '--primary-background-color': colors[4] || '#000000',
                '--secondary-background-color': colors[5] || '#000000',
                '--border-color': colors[6] || '#000000',
                '--hover-color': hoverColor // 动态设置 hover-color
            };
        }
    },
    mounted() {
        window.addEventListener('keydown', this.handleKeydown);
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.handleKeydown);
    },
    methods: {
        handleKeydown(event) {
            if (event.key === 'Escape') {
                this.closeColorPicker(); // 按下 Esc 键时关闭页面
            }
        },
        closeColorPicker() {
            this.isClosing = true;
        },
        handleAnimationEnd() {
            if (this.isClosing) {
                this.isClosing = false;
                this.$emit('close');
            }
        },
        applyColors() {
            const styles = this.dynamicStyles;
            Object.keys(styles).forEach(key => {
                document.documentElement.style.setProperty(key, styles[key]);
            });

            // 仅在应用时更新 localStorage
            localStorage.setItem('selectedMode', this.selectedMode);
            if (this.selectedMode === 'preset') {
                localStorage.setItem('activePreset', this.activePreset);
            } else {
                // 将 hover-color 与自定义颜色一起存储
                const customColorsWithHover = {
                    ...this.customColors,
                    hoverColor: styles['--hover-color']
                };
                localStorage.setItem('customColors', JSON.stringify(customColorsWithHover));
            }
        },
        resetColors() {
            this.selectedMode = 'preset';
            this.activePreset = colorPresets[0]?.name;
            this.showCustomColors = false; // 收起自定义颜色部分
            this.applyColors();
        },
        selectPreset(preset) {
            this.selectedMode = 'preset';
            this.activePreset = preset.name;
            this.showCustomColors = false; // 收起自定义颜色部分
            this.applyColors();
        },
        selectCustomColors() {
            this.selectedMode = 'custom';
            this.activePreset = null;
            this.showCustomColors = true; // 展开自定义颜色部分
            this.applyColors();
        },
        calculateHoverColor(color) {
            if (!color || typeof color !== 'string' || !color.startsWith('#') || color.length !== 7) {
                console.error('Invalid color for hover calculation:', color);
                return '#000000'; // 返回默认颜色
            }
            return this.darkenColor(color, 10);
        },
        darkenColor(color, percent) {
            const hsl = this.hexToHSL(color);
            hsl[2] -= percent / 100;
            return this.hslToHex(hsl[0], hsl[1], hsl[2]);
        },
        hexToHSL(hex) {
            if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length !== 7) {
                console.error('Invalid hex color:', hex);
                return [0, 0, 0]; // 返回默认 HSL 值
            }

            let r = parseInt(hex.slice(1, 3), 16) / 255,
                g = parseInt(hex.slice(3, 5), 16) / 255,
                b = parseInt(hex.slice(5, 7), 16) / 255;

            let max = Math.max(r, g, b),
                min = Math.min(r, g, b);

            let h, s, l = (max + min) / 2;

            if (max === min) {
                h = s = 0; // 灰色
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

            return [h * 360, s * 100, l * 100];
        },
        hslToHex(h, s, l) {
            let r, g, b;

            if (s === 0) {
                r = g = b = l;
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
    animation: fadeIn 0.3s ease-in-out;
}

.color-picker-dialog-wrapper.fade-out {
    animation: fadeOut 0.3s ease-in-out;
}

.color-picker-dialog {
    width: 35rem;
    background-color: var(--background-color);
    padding: 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    color: var(--text-color);
}

.dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
}

.dialog-header h3 {
    margin: 0;
    font-size: 1.25rem;
}

.close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-color);
}

.color-inputs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
}

.color-inputs label {
    display: block;
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
}

button {
    padding: 0.5rem 1rem;
    background-color: var(--primary-color);
    color: var(--background-color);
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: background-color 0.3s;
}

button:hover {
    background-color: var(--hover-color);
}

/* 弹窗淡入效果 */
@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

/* 弹窗淡出效果 */
@keyframes fadeOut {
    from {
        opacity: 1;
    }
    to {
        opacity: 0;
    }
}

/* 新增样式 */
.color-presets {
    margin-bottom: 1rem;
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
    /* 移除放大效果 */
}

.custom-card {
    border: 2px dashed var(--border-color);
}

.preset-title {
    font-size: 1rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
    text-align: center;
}

.preset-colors {
    display: flex;
    gap: 0.5rem;
}

.preset-color {
    width: 2rem;
    height: 1rem;
    border-radius: 0.25rem;
    border: 1px solid var(--border-color);
}

.active-custom-card {
    border: 2px dashed var(--primary-color);
}
</style>