import { getCurrentWindow } from '@tauri-apps/api/window';

import van from 'vanjs-core';
import * as culori from 'culori';

getCurrentWindow().setAlwaysOnTop(true);

const lightness_bar: HTMLCanvasElement = document.getElementById('lightness_bar') as HTMLCanvasElement;
const chroma_bar: HTMLCanvasElement = document.getElementById('chroma_bar') as HTMLCanvasElement;
const hue_ring: HTMLCanvasElement = document.getElementById('hue_ring') as HTMLCanvasElement;
const color_panel: HTMLCanvasElement = document.getElementById('color_panel') as HTMLCanvasElement;

const lightness_picker = document.getElementById('lightness_picker')!;
const chroma_picker = document.getElementById('chroma_picker')!;
const hue_picker = document.getElementById('hue_picker')!;
const color_panel_picker = document.getElementById('color_panel_picker')!;

const lightness_area = document.getElementById('lightness_area')!;
const chroma_area = document.getElementById('chroma_area')!;
const hue_area = document.getElementById('hue_area')!;
const history_bar = document.getElementById('history_bar')!;
const complex_color_input = document.getElementById('complex_color_input') as HTMLInputElement;

const basic_size = 24;

const max_lightness = 100;                  
const max_chroma = 135;
const max_hue = 360;

const lightness_bar_width = lightness_bar.width = basic_size;
const lightness_bar_height = lightness_bar.height = basic_size * 8;

const chroma_bar_width = chroma_bar.width = basic_size * 8;
const chroma_bar_height = chroma_bar.height = basic_size;

const hue_ring_radius = hue_ring.width = hue_ring.height = basic_size * 10;
const color_panel_radius = color_panel.width = color_panel.height = basic_size * 8;

const lightness_ctx = lightness_bar.getContext('2d')!;
const hue_ring_ctx = hue_ring.getContext('2d')!;
const color_panel_ctx = color_panel.getContext('2d', { willReadFrequently: true })!;
const chroma_bar_ctx = chroma_bar.getContext('2d')!;

const lightness_state = van.state(0);
const chroma_state = van.state(0);
const hue_state = van.state(0);

const color_reversed_state = van.state(false);

const history_color_list = van.state<string[]>([]);




// lightness_area -> lightness_state
lightness_area.addEventListener('mousedown', e1 => {
    if (e1.target === lightness_bar) {
        set_lightness(100 - (100 / lightness_bar_height * e1.offsetY));
    }
    
    if (e1.target === lightness_picker || e1.target === lightness_bar) {
        const listener = (e2: MouseEvent) => {
            if (e2.buttons === 1) {
                const rect = lightness_area.getBoundingClientRect();
                const offsetY = e2.clientY - rect.top;
                const lightness = 100 - (100 / lightness_bar_height * (offsetY - basic_size * 2));

                if (lightness <= 100 && lightness >= 0) {
                    set_lightness(lightness);
                }
            } else {
                lightness_area.removeEventListener('mousemove', listener);
            }
        }; 

        lightness_area.addEventListener('mousemove', listener);
    }

});

// lightness_state -> lightness_picker
van.derive(() => {
    lightness_picker.style.top = 
        basic_size * 9.5 -
        lightness_bar_height / 100 * lightness_state.val + 'px';
    lightness_picker.style.backgroundColor = `oklch(${lightness_state.val}% 0 0)`;
});

// hue_state -> color_panel
van.derive(() => {
    draw_color_panel(hue_state.val);
});

// hue_state & lightness_state -> chroma_bar
van.derive(() => {
    draw_chroma_bar(hue_state.val, lightness_state.val);
}) 

// chroma_area -> chroma_state
chroma_area.addEventListener('mousedown', e1 => {
    if (e1.target === chroma_bar) {
        const chroma = (max_chroma / chroma_bar_width * (e1.layerX - chroma_bar_width / 2)) * 2;

        if (chroma > 0) {
            color_reversed_state.val = false;
        } else if (chroma < 0) {
            color_reversed_state.val = true;
        }
        // color_reversed_state.val = chroma >= 0 ? false : true;

        if (Math.abs(chroma) > max_chroma) {
            set_chroma(max_chroma);
        } else {
            set_chroma(Math.abs(chroma));
        }
    }

    if (e1.target === chroma_bar || e1.target === chroma_picker) {
        const listener = (e2: MouseEvent) => {
            if (e2.buttons === 1) {
                
                const layerX = e2.clientX - chroma_bar.getBoundingClientRect().left;
                const chroma = (145 / chroma_bar_width * (layerX - chroma_bar_width / 2)) * 2;

                if (chroma > 0) {
                    color_reversed_state.val = false;
                } else if (chroma < 0) {
                    color_reversed_state.val = true;
                }

                if (Math.abs(chroma) > max_chroma) {
                    set_chroma(max_chroma);
                } else {
                    set_chroma(Math.abs(chroma));
                }

                

            } else {
                chroma_area.removeEventListener('mousemove', listener);
            }
        };

        chroma_area.addEventListener('mousemove', listener);
    }
})

// chroma_state -> chroma_picker
van.derive(() => {
    chroma_picker.style.left = 
        basic_size * 3.5 + // left
        basic_size * 4 + // mid
        (basic_size * 4 / max_chroma * chroma_state.val /* value */) * 
        (color_reversed_state.val ? -1 : 1) + 'px';

    chroma_picker.style.backgroundColor = `lch(${lightness_state.val}% ${chroma_state.val} ${hue_state.val})`;
});

// hue_state -> hue_picker
van.derive(() => {
    hue_picker.style.transform = `rotate(${hue_state.val}deg) translate(0, -${basic_size * 5}px) rotate(45deg)`;
    
    let max_chroma = 0;
    let fit_lightness = 0;
    for (let lightness = 0; lightness < 100; lightness ++){
        const test_color = culori.clampChroma(`lch(${lightness}% 145 ${hue_state.val})`) as culori.Lch
        if (test_color.c > max_chroma) {
            max_chroma = test_color.c;
            fit_lightness = lightness;
        }
    }

    hue_picker.style.backgroundColor = `lch(${fit_lightness}% ${max_chroma} ${hue_state.val})`;
});

// color_reversed_state -> color_panel & chroma_bar
van.derive(() => {
    if (color_reversed_state.val != color_reversed_state.oldVal) {
        set_hue((hue_state.val + 180) % 360);
    }

    
    if (! color_reversed_state.val) {
        color_panel.style.removeProperty('transform');
        chroma_bar.style.removeProperty('transform');
    } else {
        color_panel.style.transform = 'rotateY(180deg)';
        chroma_bar.style.transform = 'rotateY(180deg)';
    }
})

// lightness_state & chroma_state -> color_panel_picker
van.derive(() => {
    color_panel_picker.style.left = 
        basic_size * 5.5 + 
        chroma_bar_width / 2 / 145 * (color_reversed_state.val ? -1 : 1) * chroma_state.val + 'px';
    color_panel_picker.style.top = 
        basic_size * 9.5 -
        lightness_bar_height / 100 * lightness_state.val + 'px';

    color_panel_picker.style.backgroundColor = `lch(${lightness_state.val}% ${chroma_state.val} ${hue_state.val})`;
    
})

// color_panel -> chroma_state & lightness_state
hue_area.addEventListener('mousedown', e1 => {
    if (e1.target === color_panel_picker) {
        const listener = (e2: MouseEvent) => {
            if (e2.buttons === 1) {
                const layerX = e2.clientX - color_panel.getBoundingClientRect().left;
                const layerY = e2.clientY - color_panel.getBoundingClientRect().top;

                let lightness = 100 - (100 / lightness_bar_height * layerY);

                if (lightness >= 0 && lightness <= 100) {
                    set_lightness(lightness);
                }

                const chroma = (145 / chroma_bar_width * (layerX - chroma_bar_width / 2)) * 2;
                if (chroma > 0) {
                    color_reversed_state.val = false;
                } else if (chroma < 0) {
                    color_reversed_state.val = true;
                }

                if (Math.abs(chroma) > max_chroma) {
                    set_chroma(max_chroma);
                } else {
                    set_chroma(Math.abs(chroma));
                }


            } else {
                hue_area.removeEventListener('mousemove', listener);
            }
        };

        hue_area.addEventListener('mousemove', listener);
    } else if (e1.target === color_panel) {
        const { x, y } = getTransformedPosition(e1, color_panel);
        
        
        // 获取鼠标坐标下的像素数据
        const pixel = color_panel_ctx.getImageData(x, y, 1, 1).data;
        
        // 像素透明度不为 0
        if (pixel[3] !== 0) {

            const layerX = e1.clientX - color_panel.getBoundingClientRect().left;
            const layerY = e1.clientY - color_panel.getBoundingClientRect().top;

            let lightness = 100 - (100 / lightness_bar_height * layerY);

            if (lightness >= 0 && lightness <= 100) {
                set_lightness(lightness);
            }

            const chroma = (145 / chroma_bar_width * (layerX - chroma_bar_width / 2)) * 2;
            if (chroma > 0) {
                    color_reversed_state.val = false;
                } else if (chroma < 0) {
                    color_reversed_state.val = true;
                }

            if (Math.abs(chroma) > max_chroma) {
                set_chroma(max_chroma);
            } else {
                set_chroma(Math.abs(chroma));
            }


            const listener = (e2: MouseEvent) => {
                if (e2.buttons === 1) {
                    
                    const layerX = e2.clientX - color_panel.getBoundingClientRect().left;
                    const layerY = e2.clientY - color_panel.getBoundingClientRect().top;

                    let lightness = 100 - (100 / lightness_bar_height * layerY);

                    if (lightness >= 0 && lightness <= 100) {
                        set_lightness(lightness);
                    }

                    const chroma = (145 / chroma_bar_width * (layerX - chroma_bar_width / 2)) * 2;
                    if (chroma > 0) {
                        color_reversed_state.val = false;
                    } else if (chroma < 0) {
                        color_reversed_state.val = true;
                    }

                    if (Math.abs(chroma) > max_chroma) {
                        set_chroma(max_chroma);
                    } else {
                        set_chroma(Math.abs(chroma));
                    }

                    

                } else {
                    hue_area.removeEventListener('mousemove', listener);
                }
            };

            hue_area.addEventListener('mousemove', listener);
        } 
        // 将事件传递到 hue_ring 上
        else {
            hue_ring.dispatchEvent(new MouseEvent('mousedown', {
                clientX: e1.clientX,
                clientY: e1.clientY
            }));
        }
    } else if (e1.target === hue_picker) {
        const listener = (e2: MouseEvent) => {
            if (e2.buttons === 1) {
                const o = {
                    x: basic_size * 2 + basic_size * 12 / 2,
                    y: basic_size * 12 / 2,
                };
                const dx = e2.clientX - o.x;
                const dy = e2.clientY - o.y;
                const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360 + 90) % 360;
                set_hue(angle);
            } else {
                hue_area.removeEventListener('mousemove', listener);
            }
        };

        hue_area.addEventListener('mousemove', listener);
    }

});

hue_ring.addEventListener('mousedown', e1 => {

    const o = {
        x: basic_size * 2 + basic_size * 12 / 2,
        y: basic_size * 12 / 2,
    };
    const dx = e1.clientX - o.x;
    const dy = e1.clientY - o.y;

    const R = hue_ring_radius / 2;
    const r = color_panel_radius / 2;
    const d = Math.sqrt(dx ** 2 + dy ** 2);
    if (d > R || d < r) {
        return;
    }

    const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360 + 90) % 360;
    set_hue(angle);


    const listener = (e2: MouseEvent) => {
        if (e2.buttons === 1) {
            const o = {
                x: basic_size * 2 + basic_size * 12 / 2,
                y: basic_size * 12 / 2,
            };
            const dx = e2.clientX - o.x;
            const dy = e2.clientY - o.y;
            const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360 + 90) % 360;
            set_hue(angle);
        } else {
            hue_area.removeEventListener('mousemove', listener);
        }
    };

    hue_area.addEventListener('mousemove', listener);
})
    
// lightness_state & chroma_state & hue_state ->
document.body.addEventListener('mouseup', () => {
    const this_color = `lch(${lightness_state.val}% ${chroma_state.val} ${hue_state.val})`;
    if (history_color_list.val[0] !== this_color) {
        
        if (history_color_list.val.length == 12) {
            history_color_list.rawVal.pop();
        }
        history_color_list.val.unshift(this_color);

        
        let color_element_list = history_color_list.val.map((value) => {
            return van.tags.div({
                class: 'history_item',
                style: `
                    background-color: ${value};
                `
            });
        });

        history_bar.innerHTML = '';
        van.add(history_bar, ...color_element_list);

    }
    
})

history_bar.addEventListener('mousedown', e1 => {
    const history_item = e1.target as HTMLDivElement;
    if (history_item.className === 'history_item') {
        const parsed_color = culori.clampChroma(history_item.style.backgroundColor) as culori.Lch;
        set_color(parsed_color.l, parsed_color.c, parsed_color.h!);
    }
})

complex_color_input.addEventListener('change', e1 => {
    if (! (e1.target instanceof HTMLInputElement)) return; 

    const input_color = culori.parse(e1.target.value);

    const to_lch = culori.converter('lch');

    const lch_color = to_lch(input_color);

    if (lch_color !== undefined) {
        set_color(lch_color.l > 100 ? 100 : lch_color.l, lch_color.c, lch_color.h ? lch_color.h : 0);
        complex_color_input.style.outline = 'none';
    } else {
        complex_color_input.style.outline = '1px solid red';
    }

})

van.derive(() => {
    const hex = 
        culori
        .formatHex(
            culori.parse(
                `lch(${lightness_state.val}% ${chroma_state.val} ${hue_state.val})`
            ) as culori.Lch
        )
        .slice(1)
        .toUpperCase();

    if (complex_color_input.value !== hex) {
        complex_color_input.value = hex;
    }
})




console.log(document.body)
set_color(100, 30, 50);

lightness_picker.style.left = basic_size / 2 + 'px';
chroma_picker.style.top = basic_size * 0.5 + 'px';
hue_picker.style.left = basic_size * 5.5 + 'px';
hue_picker.style.top = basic_size * 5.5 + 'px';

draw_lightness_bar();
draw_hue_ring();




function set_lightness(value: number) {
    if (value > max_lightness || value < 0) throw new Error(value.toString());
    if (value === lightness_state.val) return;

    const clamped_color = culori.clampChroma(
        `lch(${Math.round(value)}% ${chroma_state.val} ${hue_state.val})`
    ) as culori.Lch;

    lightness_state.val = Math.round(clamped_color.l);
    set_chroma(
        clamped_color.c
    );
}

function set_chroma(value: number) {
    if (value > max_chroma || value < 0) throw new Error(value.toString());
    if (value === chroma_state.val) return;

    const clamped_color = culori.clampChroma(
        `lch(${lightness_state.val}% ${Math.floor(value)} ${hue_state.val})`
    ) as culori.Lch
    
    
    chroma_state.val = clamped_color.c;
}

function set_hue(value: number) {
    if (value > max_hue || value < 0) throw new Error(value.toString());

    const clamped_color = culori.clampChroma(
        `lch(${lightness_state.val}% ${chroma_state.val} ${Math.round(value)})`
    ) as culori.Lch;

    hue_state.val = clamped_color.h!;

    set_chroma(clamped_color.c);
}

function set_color(l: number, c: number, h: number) {
    set_lightness(l);
    set_hue(h);
    set_chroma(c);
    color_reversed_state.val = false;
}

function draw_lightness_bar() {
    const lightness_gradient = lightness_ctx.createLinearGradient(0, 0, 0, lightness_bar_height);

    for (let y = 0; y < lightness_bar_height; y ++) {
        const lightness = 100 / lightness_bar_height * y;
        lightness_gradient. addColorStop( y / lightness_bar_height, `lch(${ 100 - lightness }% 0 0)`);
    }

    lightness_ctx.fillStyle = lightness_gradient;
    lightness_ctx.fillRect(0, 0, lightness_bar_width, lightness_bar_height);
}
        
function draw_hue_ring() {
    const hue_ring_gradient = hue_ring_ctx.createConicGradient(
        0, 
        hue_ring_radius / 2, 
        hue_ring_radius / 2
    );

    
    for (let angle = 0; angle < 360; angle ++) {
        const hue = angle;
        let this_max_chroma = 0;
        let fit_lightness = 0;
        for (let lightness = 0; lightness < 100; lightness ++){
            const test_color = culori.clampChroma(`lch(${lightness}% ${max_chroma} ${hue})`) as culori.Lch
            if (test_color.c > this_max_chroma) {
                this_max_chroma = test_color.c;
                fit_lightness = lightness;
            }
        }
        
        const this_color = `lch(${ fit_lightness }% ${ this_max_chroma } ${ hue })`;
        hue_ring_gradient.addColorStop(1 / 360 * ((angle + 270) % 360), this_color);
    }

    // 图像平滑
    hue_ring_ctx.imageSmoothingEnabled = true;

    hue_ring_ctx.beginPath();
    hue_ring_ctx.fillStyle = hue_ring_gradient;
    hue_ring_ctx.arc(hue_ring_radius / 2, hue_ring_radius / 2, hue_ring_radius / 2, 0, Math.PI * 2, false);
    hue_ring_ctx.fill();

    // 绘制中间空心圆
    hue_ring_ctx.globalCompositeOperation = 'destination-out';
    hue_ring_ctx.beginPath();
    hue_ring_ctx.arc(hue_ring_radius / 2, hue_ring_radius / 2, hue_ring_radius / 2 - basic_size, 0, Math.PI * 2, false);
    hue_ring_ctx.fill();
    hue_ring_ctx.globalCompositeOperation = 'source-over';
    
}

function draw_color_panel(hue: number) {
    // 清除画布 
    color_panel_ctx.clearRect(0, 0, color_panel_radius, color_panel_radius);
    
    for (let y = 0; y < color_panel_radius; y ++) {
        const lightness = 100 / color_panel_radius * (color_panel_radius - y - 1);
        const right_test_color = culori.clampChroma(`lch(${lightness}% ${max_chroma} ${hue})`) as culori.Lch;
        const left_test_color = culori.clampChroma(`lch(${lightness}% ${max_chroma} ${(hue + 180) % 360})`) as culori.Lch;
        const right_max_chroma = right_test_color.c;
        const left_max_chroma = left_test_color.c;

        const right_gradient = color_panel_ctx.createLinearGradient(
            color_panel_radius / 2,
            y,
            color_panel_radius / 2 + color_panel_radius / 2 / max_chroma * right_max_chroma,
            y
        );
        
        const left_gradient = color_panel_ctx.createLinearGradient( 
            color_panel_radius / 2 ,
            y,
            color_panel_radius / 2 - color_panel_radius / 2 / max_chroma * left_max_chroma,
            y
        );


        for (
            let this_chroma = 0; 
            this_chroma < right_max_chroma; 
            this_chroma ++
        ) {

            right_gradient.addColorStop(
                1 / right_max_chroma * this_chroma, 
                `lch(${lightness} ${this_chroma} ${hue})`
            );
        }

        for (
            let this_chroma = 0; 
            this_chroma < left_max_chroma; 
            this_chroma ++
        ) {

            left_gradient.addColorStop(
                1 / left_max_chroma * this_chroma, 
                `lch(${lightness} ${this_chroma} ${(hue + 180) % 360})`
            );
        }

        color_panel_ctx.fillStyle  = right_gradient;
        color_panel_ctx.fillRect(
            color_panel_radius / 2, 
            y,
            color_panel_radius / 2 / max_chroma * right_max_chroma,
            1
        );

        color_panel_ctx.fillStyle  = left_gradient;
        color_panel_ctx.fillRect(
            color_panel_radius / 2 - color_panel_radius / 2 / max_chroma * left_max_chroma, 
            y,
            color_panel_radius / 2 / max_chroma * left_max_chroma,
            1
        );
    }

}

function draw_chroma_bar(hue: number, lightness: number) {
    if (typeof hue !== 'number') { throw new Error(hue); }
    if (typeof lightness !== 'number') { throw new Error(lightness); }


    const right_test_color = culori.clampChroma(`lch(${lightness}% ${max_chroma} ${hue})`) as culori.Lch;
    const left_test_color = culori.clampChroma(`lch(${lightness}% ${max_chroma} ${(hue + 180) % 360})`) as culori.Lch;
    const right_max_chroma = right_test_color.c;
    const left_max_chroma = left_test_color.c;

    const right_gradient = chroma_bar_ctx.createLinearGradient(
        chroma_bar_width / 2, chroma_bar_height / 2,
        chroma_bar_width / 2 + chroma_bar_width / 2 / max_chroma * right_max_chroma, 
        chroma_bar_height / 2
    );

    const left_gradient = chroma_bar_ctx.createLinearGradient(
        chroma_bar_width / 2 - chroma_bar_width / 2 / max_chroma * left_max_chroma, 
        chroma_bar_height / 2,
        chroma_bar_width / 2, chroma_bar_height / 2,
        
    );


    for (let this_chroma = 0; this_chroma < right_max_chroma; this_chroma ++) {
        right_gradient.addColorStop(
            1 / right_max_chroma * this_chroma, 
            `lch(${lightness} ${this_chroma} ${hue})`
        );
    }

    for (let this_chroma = 0; this_chroma < left_max_chroma; this_chroma ++) {

        left_gradient.addColorStop(
            1 - (1 / left_max_chroma * this_chroma), 
            `lch(${lightness} ${this_chroma} ${(hue + 180) % 360})`
        );
    }

    chroma_bar_ctx.fillStyle = right_gradient;
    chroma_bar_ctx.fillRect(
        chroma_bar_width / 2, 
        0,
        chroma_bar_width / 2 / max_chroma * right_max_chroma,
        chroma_bar_height
    );

    chroma_bar_ctx.fillStyle = `lch(${lightness} ${right_max_chroma} ${hue})`;
    chroma_bar_ctx.fillRect(
        chroma_bar_width / 2 + chroma_bar_width / 2 / max_chroma * right_max_chroma - 1, 
        0,
        chroma_bar_width - chroma_bar_width / 2 / max_chroma * right_max_chroma,
        chroma_bar_height
    );


    chroma_bar_ctx.fillStyle  = left_gradient;
    chroma_bar_ctx.fillRect(
        chroma_bar_width / 2 - chroma_bar_width / 2 / max_chroma * left_max_chroma, 
        0,
        chroma_bar_width / 2 / max_chroma * left_max_chroma,
        chroma_bar_height
    );

    chroma_bar_ctx.fillStyle = `lch(${lightness} ${left_max_chroma} ${(hue + 180) % 360}})`;
    chroma_bar_ctx.fillRect(
        0, 0,
        chroma_bar_width / 2 - chroma_bar_width / 2 / max_chroma * left_max_chroma + 1,
        chroma_bar_height
    );

}

function getTransformedPosition(event: MouseEvent, canvas: HTMLCanvasElement) {
    // 获取 canvas 的边界矩形
    const rect = canvas.getBoundingClientRect();
    
    // 获取鼠标在画布上的位置（相对于画布边界框）
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    
    // 如果进行了 rotateY(180deg)，则进行坐标映射（即翻转 X 轴）
    const style = window.getComputedStyle(canvas);
    const transform = style.transform;

    // 检查是否有 180 度旋转
    if (transform.includes('matrix')) {
        // 解析矩阵值
        // @ts-ignore
        const values = transform.match(/matrix.*\((.+)\)/)[1].split(', ');

        const scaleX = parseFloat(values[0]);
        const scaleY = parseFloat(values[3]);

        // 如果 scaleX 为负值，则说明进行了水平翻转
        if (scaleX === -1) {
        x = rect.width - x;  // 水平翻转
        }
        if (scaleY === -1) {
        y = rect.height - y;  // 垂直翻转
        }
    }

    return { x, y };
}