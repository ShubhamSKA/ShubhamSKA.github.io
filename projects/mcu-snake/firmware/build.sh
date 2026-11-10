#!/usr/bin/env bash
# Builds firmware.bin, the image the page runs on its two emulated boards, from the
# unmodified sources of github.com/larkins-andrew/mcu-snake (branch platformio).
#
# Nothing in the game's sources is changed. The only things supplied here are what
# PlatformIO supplied for `framework = cmsis`: ST's CMSIS device files (startup code,
# system_stm32f0xx.c, register headers), the CMSIS core headers, a linker script, and
# the compiler flags from the project's .pio/build/nucleo_f091rc/idedata.json.
#
# Needs git and an arm-none-eabi GCC on PATH (or ARM_GCC_BIN set to its bin folder).
#   bash build.sh            # clones the three repositories into a temporary folder
#   SNAKE=... DEVICE=... CORE=... bash build.sh   # or point at existing checkouts
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SNAKE_COMMIT=7dd89e7      # platformio branch, "chanhged gitignore to original"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ -z "${SNAKE:-}" ]; then
  git clone -q --branch platformio https://github.com/larkins-andrew/mcu-snake.git "$WORK/mcu-snake"
  git -C "$WORK/mcu-snake" checkout -q "$SNAKE_COMMIT"
  SNAKE="$WORK/mcu-snake"
fi
if [ -z "${DEVICE:-}" ]; then
  git clone -q --depth 1 https://github.com/STMicroelectronics/cmsis_device_f0.git "$WORK/cmsis_device_f0"
  DEVICE="$WORK/cmsis_device_f0"
fi
if [ -z "${CORE:-}" ]; then
  git clone -q --depth 1 https://github.com/STMicroelectronics/cmsis_core.git "$WORK/cmsis_core"
  CORE="$WORK/cmsis_core"
fi

BIN="${ARM_GCC_BIN:+$ARM_GCC_BIN/}"
CC="${BIN}arm-none-eabi-gcc"
OBJCOPY="${BIN}arm-none-eabi-objcopy"
OBJDUMP="${BIN}arm-none-eabi-objdump"
NM="${BIN}arm-none-eabi-nm"

# Flags from idedata.json. -std=gnu11 is GCC 7's default (the project was built with
# PlatformIO's GCC 7.2.1); newer GCCs default to C23, where `void set_dir();` means "no
# arguments" and the game's calls to it would not compile. GCC 14 also made implicit
# declarations an error (main.c calls end_of_game, game.c calls nano_wait, neither
# declared), so that is put back to the warning GCC 7 gave.
CFLAGS=(-std=gnu11 -Os -ffunction-sections -fdata-sections -Wall -mthumb -mcpu=cortex-m0
        -Wno-error=implicit-function-declaration
        -DPLATFORMIO=60116 -DSTM32F0 -DSTM32F091xC -DF_CPU=48000000L
        -I"$SNAKE/include" -I"$SNAKE/src" -I"$CORE/CMSIS/Core/Include" -I"$DEVICE/Include" -g)

OUT="${KEEP:-$WORK/build}"   # KEEP=dir keeps the .elf, .map and objects
mkdir -p "$OUT"
objs=()
for c in "$SNAKE"/src/*.c "$DEVICE/Source/Templates/system_stm32f0xx.c"; do
  o="$OUT/$(basename "${c%.c}").o"
  "$CC" "${CFLAGS[@]}" -c "$c" -o "$o" 2> >(grep -v "^$" >&2 || true)
  objs+=("$o")
done
"$CC" -mthumb -mcpu=cortex-m0 -c "$DEVICE/Source/Templates/gcc/startup_stm32f091xc.s" -o "$OUT/startup.o"
objs+=("$OUT/startup.o")

"$CC" -Os -mthumb -mcpu=cortex-m0 -Wl,--gc-sections --specs=nano.specs --specs=nosys.specs \
  -T "$HERE/stm32f091rc.ld" -Wl,-Map="$OUT/firmware.map" "${objs[@]}" -o "$OUT/firmware.elf"

"$OBJCOPY" -O binary "$OUT/firmware.elf" "$HERE/firmware.bin"

# The page names each board's state from main.c's state machine. Every state waits in its
# own `asm("wfi")`, so the address of each wfi, and the main.c line it came from, is
# enough to tell them apart. Function addresses are kept for the same purpose.
{
  echo "{"
  echo "  \"compiler\": \"$("$CC" --version | head -1 | sed 's/"/\\"/g')\","
  echo "  \"snakeCommit\": \"$(git -C "$SNAKE" rev-parse HEAD 2>/dev/null || echo "$SNAKE_COMMIT")\","
  echo "  \"wfi\": {"
  "$OBJDUMP" -d -l --no-show-raw-insn "$OUT/firmware.elf" \
    | awk '/^[^ \t].*:[0-9]+( \(discriminator [0-9]+\))?$/ { s = $0; sub(/ \(discriminator [0-9]+\)$/, "", s)
             line = s; sub(/.*:/, "", line); file = s; sub(/:[0-9]+$/, "", file); sub(/.*[\\\/]/, "", file) }
           /^ *[0-9a-f]+:\twfi/ { sub(/:.*/, "", $1); printf "%s    \"0x%s\": \"%s:%d\"", sep, $1, file, line; sep = ",\n" }
           END { print "" }'
  echo "  },"
  echo "  \"symbols\": {"
  "$NM" "$OUT/firmware.elf" | awk '$2 ~ /^[TtDdBb]$/ && $3 !~ /^\$/ { printf "%s    \"%s\": \"0x%s\"", sep, $3, $1; sep = ",\n" } END { print "" }'
  echo "  }"
  echo "}"
} > "$HERE/firmware.json"

"${BIN}arm-none-eabi-size" "$OUT/firmware.elf"
echo "wrote $HERE/firmware.bin and firmware.json"
