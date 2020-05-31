class CPU {

    constructor() {
        this.display_width = 64;
        this.display_height = 32;
        this.display = new Array(this.display_width * this.display_height);
        this.step = null;
        this.renderer = null;
        this.running = null;


        var memory = new ArrayBuffer(0x1000);

        this.memory = new Uint8Array(memory);
        this.v = new Array(16); // register
        this.i = null;
        this.stack = new Array(16);
        this.sp = null;
        this.delayTimer = null;
        this.soundTimer = null;

        this.keys = {};
    }

    loadProgram(program) {
        for (let i = 0; i < program.length; i++)
            this.memory[i + 0x200] = program[i];
    }

    setKey(key) {
        this.keys[key] = true;
    }

    unsetKey(key) {
        delete this.keys[key];
    }

    setRenderer(renderer) {
        this.renderer = renderer;
    }

    getDisplayWidth() {
        return this.display_width;
    }

    getDisplayHeight() {
        return this.display_height;
    }

    setPixel(x, y) {
        let location;
        let width = this.getDisplayWidth();
        let height = this.getDisplayHeight();

        if (x > width) {
            x -= width;
        } else if (x < 0) {
            x += width;
        }
        if (y > height) {
            y -= height;
        } else if (y < 0) {
            y += height;
        }

        location = x + (y * width);

        this.display[location] ^= 1;

        return !this.display[location];
    }

    reset() {
        let i;

        for (i = 0; i < this.memory.length; i++)
            this.memory[i] = 0;

        var hexChars = [
            0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
            0x20, 0x60, 0x20, 0x20, 0x70, // 1
            0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
            0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
            0x90, 0x90, 0xF0, 0x10, 0x10, // 4
            0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
            0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
            0xF0, 0x10, 0x20, 0x40, 0x40, // 7
            0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
            0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
            0xF0, 0x90, 0xF0, 0x90, 0x90, // A
            0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
            0xF0, 0x80, 0x80, 0x80, 0xF0, // C
            0xE0, 0x90, 0x90, 0x90, 0xE0, // D
            0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
            0xF0, 0x80, 0xF0, 0x80, 0x80 // F
        ];

        for (i = 0; i < hexChars.length; i++)
            this.memory[i] = hexChars[i];

        // Reset registers.
        for (i = 0; i < this.v.length; i++)
            this.v[i] = 0;

        // Reset display.
        for (i = 0; i < this.display.length; i++)
            this.display[i] = 0;


        this.sp = 0;
        this.i = 0;

        this.pc = 0x200;

        this.delayTimer = 0;
        this.soundTimer = 0;
        this.step = 0;
        this.running = false;
    }

    start() {
        var i;
        if (!this.renderer) {
            throw new Error("You must specify a renderer.");
        }

        this.running = true;

        let me = () => {
            for (let i = 0; i < 10; i++) {
                if (this.running) {
                    this.emulateCycle();
                }
            }

            if (this.drawFlag) {
                this.renderer.render(this.display);
                this.drawFlag = false;
            }

            if (!(this.step++ % 2))
                this.handleTimers();

            requestAnimationFrame(me);
        }

        requestAnimationFrame(me);
    }

    stop() {
        this.running = false;
    }

    handleTimers() {
        if (this.delayTimer > 0) {
            this.delayTimer--;
        }

        if (this.soundTimer > 0) {
            if (this.soundTimer == 1) {
                this.renderer.beep();
            }
            this.soundTimer--;
        }
    }

    emulateCycle() {
        let opcode = this.memory[this.pc] << 8 | this.memory[this.pc + 1];
        let x = (opcode & 0x0F00) >> 8;
        let y = (opcode & 0x00F0) >> 4;

        this.pc += 2;

        switch (opcode & 0xf000) {
            case 0x0000:
                switch (opcode) {
                    // Clear the display
                    case 0x00E0:
                        this.renderer.clear();
                        for (let i = 0; i < this.display.length; i++)
                            this.display[i] = 0;

                        break;

                    // Return
                    case 0x00EE:
                        this.pc = this.stack[--this.sp];
                        break;
                }

                break;

            // goto
            case 0x1000:
                this.pc = opcode & 0xFFF;
                break;

            // call subroutine
            case 0x2000:
                this.stack[this.sp] = this.pc;
                this.sp++;
                this.pc = opcode & 0xFFF;
                break;


            // skip next instruction if Vx == NN
            case 0x3000:
                if (this.v[x] === (opcode & 0x00FF))
                    this.pc += 2;

                break;

            // skip next instruction if Vx != NN
            case 0x4000:
                if (this.v[x] !== (opcode & 0x00FF))
                    this.pc += 2;

                break;

            // skip next instruction if Vx == Vy
            case 0x5000:
                if (this.v[x] === this.v[y])
                    this.pc += 2;

                break;

            // set Vx to NN
            case 0x6000:
                this.v[x] = (opcode & 0x00FF);
                break;

            // add NN to Vx
            case 0x7000:
                var val = (opcode & 0x00FF) + this.v[x];

                if (val > 255)
                    val -= 256;

                this.v[x] = val;
                break;

            case 0x8000:
                {
                    switch (opcode & 0x000f) {
                        // set Vx to Vy
                        case 0x0000:
                            this.v[x] = this.v[y];
                            break;

                        // set Vx to (Vx | Vy)
                        case 0x0001:
                            this.v[x] |= this.v[y];
                            break;

                        // set Vx to (Vx & Vy)
                        case 0x0002:
                            this.v[x] &= this.v[y];
                            break;

                        // set Vx to (Vx ^ Vy)
                        case 0x0003:
                            this.v[x] ^= this.v[y];
                            break;

                        // 	Adds VY to VX. VF is set to 1 when there's a carry, and to 0 when there isn't.
                        case 0x0004:
                            this.v[x] += this.v[y];
                            this.v[0xF] = +(this.v[x] > 255);
                            if (this.v[x] > 255)
                                this.v[x] -= 256;

                            break;

                        //  VY is subtracted from VX.VF is set to 0 when there's a borrow, and 1 when there isn't.
                        case 0x0005:
                            this.v[0xF] = +(this.v[x] > this.v[y]);
                            this.v[x] -= this.v[y];
                            if (this.v[x] < 0)
                                this.v[x] += 256;

                            break;

                        // Stores the least significant bit of VX in VF and then shifts VX to the right by 1
                        case 0x0006:
                            this.v[0xF] = this.v[x] & 0x1;
                            this.v[x] >>= 1;
                            break;

                        case 0x0007:
                            this.v[0xF] = +(this.v[y] > this.v[x]);
                            this.v[x] = this.v[y] - this.v[x];
                            if (this.v[x] < 0)
                                this.v[x] += 256;

                            break;

                        case 0x000E:
                            this.v[0xF] = +(this.v[x] & 0x80);
                            this.v[x] <<= 1;
                            if (this.v[x] > 255)
                                this.v[x] -= 256;

                            break;


                    }
                    break;
                }

            // Skips the next instruction if VX doesn't equal VY.
            case 0x9000:
                if (this.v[x] !== this.v[y])
                    this.pc += 2;

                break;

            // Sets I to the address NNN.
            case 0xA000:
                this.i = opcode & 0x0FFF;
                break;

            // Jumps to the address NNN plus V0.
            case 0xB000:
                this.pc = (opcode & 0x0FFF) + this.v[0];
                break;

            // Sets VX to the result of a bitwise and operation on a random number (Typically: 0 to 255) and NN.
            case 0xC000:
                this.v[x] = Math.floor(Math.random() * 0x00FF) & (opcode & 0x00FF)
                break;

            // Display 
            case 0xD000:
                this.v[0xF] = 0;

                let height = opcode & 0x000F;
                let registerX = this.v[x];
                let registerY = this.v[y];

                for (y = 0; y < height; y++) {
                    let spr = this.memory[this.i + y];
                    for (let x = 0; x < 8; x++) {
                        if ((spr & 0x80) > 0) {
                            if (this.setPixel(registerX + x, registerY + y)) {
                                this.v[0xF] = 1;
                            }
                        }
                        spr <<= 1;
                    }
                }
                this.drawFlag = true;

                break;

            case 0xE000:
                switch (opcode & 0x00FF) {
                    case 0x009E:
                        if (this.keys[this.v[x]])
                            this.pc += 2;

                        break;

                    case 0x00A1:
                        if (!this.keys[this.v[x]])
                            this.pc += 2;

                        break;
                }
                break;

            case 0xF000:
                switch (opcode & 0x00FF) {
                    case 0x0007:
                        this.v[x] = this.delayTimer;
                        break;

                    case 0x000A:
                        let oldKeyDown = this.setKey;
                        let self = this;
                        this.setKey = function () {
                            self.v[x] = key;

                            self.setKey = oldKeyDown.bind(self);
                            self.setKey.apply(self, arguments);

                            self.start();
                        }

                        this.stop();
                        return;

                    case 0x0015:
                        this.delayTimer = this.v[x];
                        break;

                    // Set sound timer to Vx.
                    case 0x0018:
                        this.soundTimer = this.v[x];
                        break;

                    // Set I equal to I + Vx
                    case 0x001E:
                        this.i += this.v[x];
                        break;

                    // Set I equal to location of sprite for digit Vx.
                    case 0x0029:
                        this.i = this.v[x] * 5;
                        break;

                    // Store BCD representation of Vx in memory location starting at location I.
                    case 0x0033:
                        var number = this.v[x], i;

                        for (i = 3; i > 0; i--) {
                            this.memory[this.i + i - 1] = parseInt(number % 10);
                            number /= 10;
                        }
                        break;

                    // Store registers V0 through Vx in memory starting at location I.
                    case 0x0055:
                        for (var i = 0; i <= x; i++) {
                            this.memory[this.i + i] = this.v[i];
                        }
                        break;

                    // Read registers V0 through Vx from memory starting at location I.
                    case 0x0065:
                        for (var i = 0; i <= x; i++) {
                            this.v[i] = this.memory[this.i + i];
                        }
                        break;
                }
                break;

            default:
                throw new Error("Unknown opcode " + opcode.toString(16) + " passed. Terminating.");
        }
    }
}