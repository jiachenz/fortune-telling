/**
 * 铜钱模块 - 处理铜钱投掷动画和卦象生成
 * ==========================================
 * 传统六爻占卜方法：
 * - 三枚铜钱同时抛出，共抛六次
 * - 正面为阳（值为3），反面为阴（值为2）
 * - 三枚铜钱之和：
 *   - 6（三反）= 老阴（变爻）
 *   - 7（二反一正）= 少阳
 *   - 8（二正一反）= 少阴
 *   - 9（三正）= 老阳（变爻）
 */

// ========================================
// 六十四卦数据
// ========================================

const HEXAGRAMS = {
    '111111': { name: '乾为天', nature: '元亨利贞', symbol: '☰☰' },
    '000000': { name: '坤为地', nature: '元亨利牝马之贞', symbol: '☷☷' },
    '100010': { name: '水雷屯', nature: '元亨利贞，勿用有攸往', symbol: '☵☳' },
    '010001': { name: '山水蒙', nature: '亨，匪我求童蒙', symbol: '☶☵' },
    '111010': { name: '水天需', nature: '有孚，光亨贞吉', symbol: '☵☰' },
    '010111': { name: '天水讼', nature: '有孚窒惕，中吉', symbol: '☰☵' },
    '010000': { name: '地水师', nature: '贞丈人吉，无咎', symbol: '☷☵' },
    '000010': { name: '水地比', nature: '吉，原筮元永贞', symbol: '☵☷' },
    '111011': { name: '风天小畜', nature: '亨，密云不雨', symbol: '☴☰' },
    '110111': { name: '天泽履', nature: '履虎尾，不咥人', symbol: '☰☱' },
    '111000': { name: '地天泰', nature: '小往大来，吉亨', symbol: '☷☰' },
    '000111': { name: '天地否', nature: '否之匪人，不利', symbol: '☰☷' },
    '101111': { name: '天火同人', nature: '同人于野，亨', symbol: '☰☲' },
    '111101': { name: '火天大有', nature: '元亨', symbol: '☲☰' },
    '001000': { name: '地山谦', nature: '亨，君子有终', symbol: '☷☶' },
    '000100': { name: '雷地豫', nature: '利建侯行师', symbol: '☳☷' },
    '100110': { name: '泽雷随', nature: '元亨利贞，无咎', symbol: '☱☳' },
    '011001': { name: '山风蛊', nature: '元亨，利涉大川', symbol: '☶☴' },
    '110000': { name: '地泽临', nature: '元亨利贞', symbol: '☷☱' },
    '000011': { name: '风地观', nature: '盥而不荐，有孚颙若', symbol: '☴☷' },
    '100101': { name: '火雷噬嗑', nature: '亨，利用狱', symbol: '☲☳' },
    '101001': { name: '山火贲', nature: '亨，小利有攸往', symbol: '☶☲' },
    '000001': { name: '山地剥', nature: '不利有攸往', symbol: '☶☷' },
    '100000': { name: '地雷复', nature: '亨，出入无疾', symbol: '☷☳' },
    '100111': { name: '天雷无妄', nature: '元亨利贞', symbol: '☰☳' },
    '111001': { name: '山天大畜', nature: '利贞，不家食吉', symbol: '☶☰' },
    '100001': { name: '山雷颐', nature: '贞吉，观颐', symbol: '☶☳' },
    '011110': { name: '泽风大过', nature: '栋桡，利有攸往', symbol: '☱☴' },
    '010010': { name: '坎为水', nature: '有孚维心亨', symbol: '☵☵' },
    '101101': { name: '离为火', nature: '利贞，亨，畜牝牛吉', symbol: '☲☲' },
    '001110': { name: '泽山咸', nature: '亨利贞，取女吉', symbol: '☱☶' },
    '011100': { name: '雷风恒', nature: '亨无咎利贞', symbol: '☳☴' },
    '001111': { name: '天山遁', nature: '亨，小利贞', symbol: '☰☶' },
    '111100': { name: '雷天大壮', nature: '利贞', symbol: '☳☰' },
    '000101': { name: '火地晋', nature: '康侯用锡马蕃庶', symbol: '☲☷' },
    '101000': { name: '地火明夷', nature: '利艰贞', symbol: '☷☲' },
    '101011': { name: '风火家人', nature: '利女贞', symbol: '☴☲' },
    '110101': { name: '火泽睽', nature: '小事吉', symbol: '☲☱' },
    '001010': { name: '水山蹇', nature: '利西南不利东北', symbol: '☵☶' },
    '010100': { name: '雷水解', nature: '利西南无所往', symbol: '☳☵' },
    '110001': { name: '山泽损', nature: '有孚元吉无咎', symbol: '☶☱' },
    '100011': { name: '风雷益', nature: '利有攸往利涉大川', symbol: '☴☳' },
    '111110': { name: '泽天夬', nature: '扬于王庭，孚号有厉', symbol: '☱☰' },
    '011111': { name: '天风姤', nature: '女壮，勿用取女', symbol: '☰☴' },
    '000110': { name: '泽地萃', nature: '亨，王假有庙', symbol: '☱☷' },
    '011000': { name: '地风升', nature: '元亨，用见大人', symbol: '☷☴' },
    '010110': { name: '泽水困', nature: '亨贞大人吉无咎', symbol: '☱☵' },
    '011010': { name: '水风井', nature: '改邑不改井，无丧无得', symbol: '☵☴' },
    '101110': { name: '泽火革', nature: '己日乃孚，元亨利贞', symbol: '☱☲' },
    '011101': { name: '火风鼎', nature: '元吉亨', symbol: '☲☴' },
    '100100': { name: '震为雷', nature: '亨，震来虩虩', symbol: '☳☳' },
    '001001': { name: '艮为山', nature: '艮其背不获其身', symbol: '☶☶' },
    '001011': { name: '风山渐', nature: '女归吉，利贞', symbol: '☴☶' },
    '110100': { name: '雷泽归妹', nature: '征凶，无攸利', symbol: '☳☱' },
    '101100': { name: '雷火丰', nature: '亨，王假之', symbol: '☳☲' },
    '001101': { name: '火山旅', nature: '小亨，旅贞吉', symbol: '☲☶' },
    '011011': { name: '巽为风', nature: '小亨，利有攸往', symbol: '☴☴' },
    '110110': { name: '兑为泽', nature: '亨利贞', symbol: '☱☱' },
    '010011': { name: '风水涣', nature: '亨，王假有庙', symbol: '☴☵' },
    '110010': { name: '水泽节', nature: '亨，苦节不可贞', symbol: '☵☱' },
    '110011': { name: '风泽中孚', nature: '豚鱼吉，利涉大川', symbol: '☴☱' },
    '001100': { name: '雷山小过', nature: '亨利贞，可小事', symbol: '☳☶' },
    '101010': { name: '水火既济', nature: '亨小利贞，初吉终乱', symbol: '☵☲' },
    '010101': { name: '火水未济', nature: '亨，小狐汔济', symbol: '☲☵' },
};

// ========================================
// 铜钱类
// ========================================

class CoinModule {
    constructor() {
        this.isFlipping = false;
        this.throwCount = 0;
        this.yaoResults = [];
        this.coinElements = [];
        this.yaoLineElements = [];
        this.throwResultElement = null;
        this.throwBtnElement = null;
        this.currentThrowElement = null;
        this.onComplete = null; // 完成六爻后的回调
    }

    /**
     * 初始化铜钱模块
     */
    init(options) {
        this.coinElements = options.coins || [];
        this.yaoLineElements = options.yaoLines || [];
        this.throwResultElement = options.throwResult;
        this.throwBtnElement = options.throwBtn;
        this.currentThrowElement = options.currentThrow;
        this.onComplete = options.onComplete;
        this.defaultHintText = options.defaultHintText || '点击下方按钮掷出铜钱';
    }

    /**
     * 翻转单个铜钱动画
     */
    flipCoin(coinElement, showFront) {
        return new Promise(resolve => {
            const finalRotation = showFront ? 0 : 180;
            // 增加随机性，让每个铜钱的最终旋转角度略有不同
            const randomOffset = Math.floor(Math.random() * 4) * 360;
            coinElement.querySelector('.coin-inner').style.setProperty(
                '--final-rotation', 
                `${finalRotation + 2880 + randomOffset}deg`
            );
            
            coinElement.classList.add('flipping');
            
            // 动画完成后添加落地效果
            setTimeout(() => {
                coinElement.classList.remove('flipping');
                coinElement.classList.remove('show-front', 'show-back');
                coinElement.classList.add(showFront ? 'show-front' : 'show-back');
                coinElement.classList.add('landed');
                
                // 移除落地效果类
                setTimeout(() => {
                    coinElement.classList.remove('landed');
                }, 300);
                
                resolve();
            }, 1000); // 与CSS动画时长匹配
        });
    }

    /**
     * 投掷三枚铜钱
     */
    async throwCoins() {
        if (this.isFlipping || this.throwCount >= 6) return;
        
        this.isFlipping = true;
        if (this.throwBtnElement) {
            this.throwBtnElement.disabled = true;
        }
        
        // 随机生成三枚铜钱的结果
        const results = [];
        for (let i = 0; i < 3; i++) {
            results.push(Math.random() < 0.5); // true = 正面（阳），false = 反面（阴）
        }
        
        // 动画翻转铜钱
        await Promise.all(this.coinElements.map((coin, i) => this.flipCoin(coin, results[i])));
        
        // 计算这一爻的值 (正面 = 3，反面 = 2)
        const value = results.reduce((sum, isFront) => sum + (isFront ? 3 : 2), 0);
        
        // 判断阴阳和动爻
        const yaoInfo = this.calculateYao(value);
        
        // 存储结果
        this.yaoResults.push({ value, ...yaoInfo });
        this.throwCount++;
        
        // 更新UI显示
        this.updateThrowResult(results, yaoInfo);
        this.updateYaoLine(yaoInfo);
        this.updateThrowCount();
        
        this.isFlipping = false;
    }

    /**
     * 计算爻的类型
     */
    calculateYao(value) {
        switch (value) {
            case 6: // 三反 - 老阴（变爻）
                return { type: 'yin', moving: true };
            case 7: // 二反一正 - 少阳
                return { type: 'yang', moving: false };
            case 8: // 二正一反 - 少阴
                return { type: 'yin', moving: false };
            case 9: // 三正 - 老阳（变爻）
                return { type: 'yang', moving: true };
            default:
                return { type: 'yang', moving: false };
        }
    }

    /**
     * 更新投掷结果显示
     */
    updateThrowResult(results, yaoInfo) {
        if (!this.throwResultElement) return;
        
        const frontCount = results.filter(r => r).length;
        const backCount = 3 - frontCount;
        let resultText = `${frontCount}正${backCount}反 → `;
        
        const resultSpan = this.throwResultElement.querySelector('.result-text');
        if (yaoInfo.type === 'yang') {
            resultText += yaoInfo.moving ? '老阳（动爻）━━━○' : '少阳 ━━━━━';
            resultSpan.className = 'result-text yang';
        } else {
            resultText += yaoInfo.moving ? '老阴（动爻）━ ━✕' : '少阴 ━━ ━━';
            resultSpan.className = 'result-text yin';
        }
        resultSpan.textContent = resultText;
    }

    /**
     * 更新爻线显示
     */
    updateYaoLine(yaoInfo) {
        const yaoLine = this.yaoLineElements[this.throwCount - 1];
        if (!yaoLine) return;
        
        yaoLine.className = 'yao-line';
        if (yaoInfo.moving) {
            yaoLine.classList.add(yaoInfo.type === 'yang' ? 'yang-moving' : 'yin-moving');
        } else {
            yaoLine.classList.add(yaoInfo.type);
        }
    }

    /**
     * 更新投掷计数
     */
    updateThrowCount() {
        if (this.throwCount < 6) {
            if (this.currentThrowElement) {
                this.currentThrowElement.textContent = this.throwCount + 1;
            }
            if (this.throwBtnElement) {
                this.throwBtnElement.disabled = false;
            }
        } else {
            // 完成六爻
            if (this.throwBtnElement) {
                this.throwBtnElement.style.display = 'flex'; // 确保在PC端隐藏后能重新显示
                this.throwBtnElement.textContent = '查看卦象';
                this.throwBtnElement.disabled = false;
                this.throwBtnElement.onclick = () => {
                    if (this.onComplete) {
                        this.onComplete(this.generateHexagram());
                    }
                };
            }
        }
    }

    /**
     * 生成卦象
     */
    generateHexagram() {
        // 将六爻转换为二进制字符串（从初爻到上爻）
        const binaryStr = this.yaoResults
            .map(yao => yao.type === 'yang' ? '1' : '0')
            .join('');
        
        // 查找卦象
        const hexagram = HEXAGRAMS[binaryStr];
        
        // 检查是否有动爻，生成变卦
        const hasMovingYao = this.yaoResults.some(yao => yao.moving);
        let changedHexagram = null;
        
        if (hasMovingYao) {
            const changedBinaryStr = this.yaoResults
                .map(yao => {
                    if (yao.moving) {
                        return yao.type === 'yang' ? '0' : '1'; // 动爻变化
                    }
                    return yao.type === 'yang' ? '1' : '0';
                })
                .join('');
            changedHexagram = HEXAGRAMS[changedBinaryStr];
        }
        
        return { 
            main: hexagram || { name: '未知卦象', nature: '', symbol: '' }, 
            changed: changedHexagram,
            hasMoving: hasMovingYao,
            movingPositions: this.yaoResults.map((yao, i) => yao.moving ? i + 1 : null).filter(Boolean),
            yaoResults: this.yaoResults
        };
    }

    /**
     * 重置铜钱模块
     */
    reset() {
        this.throwCount = 0;
        this.yaoResults = [];
        this.isFlipping = false;
        
        // 重置铜钱显示
        this.coinElements.forEach(coin => {
            coin.classList.remove('show-front', 'show-back', 'flipping');
        });
        
        // 重置爻线显示
        this.yaoLineElements.forEach(line => {
            line.className = 'yao-line';
        });
        
        // 重置UI
        if (this.currentThrowElement) {
            this.currentThrowElement.textContent = '1';
        }
        if (this.throwResultElement) {
            const resultSpan = this.throwResultElement.querySelector('.result-text');
            resultSpan.textContent = this.defaultHintText;
            resultSpan.className = 'result-text';
        }
        if (this.throwBtnElement) {
            this.throwBtnElement.textContent = '掷铜钱';
            this.throwBtnElement.disabled = false;
        }
    }

    /**
     * 获取爻结果
     */
    getYaoResults() {
        return this.yaoResults;
    }
}

// 导出模块
window.CoinModule = CoinModule;
window.HEXAGRAMS = HEXAGRAMS;
