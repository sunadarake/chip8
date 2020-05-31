class Renderer {
    constructor(canvas, width, height, cellSize) {

        this.ctx = canvas.getContext("2d");
        this.canvas = canvas;
        this.width = width;
        this.height = height;
        this.lastRenderedData = [];

        this.setCellSize(cellSize);
        this.lastDraw = 0;
        this.draws = 0;

        this.fgColor = "#0f0";
        this.bgColor = "transparent";

        this.audioContext = window.AudioContext && new AudioContext;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width * this.cellSize, this.height * this.cellSize);
    }

    render(display) {
        this.clear();
        this.lastRenderedData = display;

        for (let i = 0; i < display.length; i++) {
            let x = (i % this.width) * this.cellSize;
            let y = Math.floor(i / this.width) * this.cellSize;

            this.ctx.fillStyle = [this.bgColor, this.fgColor][display[i]];
            this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
        }

        this.draws++;
    }

    beep() {
        if (this.audioContext) {
            var osc = this.audioContext.createOscillator();
            osc.connect(this.audioContext.destination);
            osc.type = "triangle";
            osc.start();
            setTimeout(function () {
                osc.stop();
            }, 100);
            return;
        }

        var times = 5;
        var interval = setInterval(function (canvas) {
            if (!times--) {
                clearInterval(interval);
            }

            canvas.style.left = times % 2 ? "-3px" : "3px";

        }, 50, this.canvas);
    }

    setCellSize(cellSize) {
        this.cellSize = cellSize;
        this.canvas.width = cellSize * this.width;
        this.canvas.height = cellSize * this.height;
        this.render(this.lastRenderedData);
    }
}