'use strict';

/**
 * 二分拆弹页面的四语言参考实现。
 * 目标范围固定为 1–100，返回命中的数字与猜测次数。
 */
window.BINARY_SEARCH_DOCS = {
  cpp: {
    label: 'C++',
    chip: 'C++17',
    filename: 'binary_bomb.cpp',
    note: '用 low + (high - low) / 2 计算中点，避免 low + high 在更大范围时溢出。循环始终维护“答案在 [low, high] 内”的不变量，因此最后一定能在 7 次内命中。',
    code: `struct GuessResult {
    int secret;
    int guesses;
};

GuessResult crackBomb(int secret) {
    int low = 1;
    int high = 100;
    int guesses = 0;

    while (low <= high) {
        int mid = low + (high - low) / 2;
        ++guesses;

        if (mid == secret) {
            return {secret, guesses};
        }

        if (mid < secret) {
            low = mid + 1;   // 密码在右半边
        } else {
            high = mid - 1;  // 密码在左半边
        }
    }

    return {-1, guesses};
}`
  },

  java: {
    label: 'Java',
    chip: 'Java 17',
    filename: 'BinaryBomb.java',
    note: '用 low + (high - low) / 2 计算中点更稳妥。Result 对象同时返回密码和猜测次数；循环条件、左右边界更新与 C++ 实现保持一致。',
    code: `public class BinaryBomb {
    static final int LOWER = 1;
    static final int UPPER = 100;

    static class Result {
        final int secret;
        final int guesses;

        Result(int secret, int guesses) {
            this.secret = secret;
            this.guesses = guesses;
        }
    }

    public static Result crack(int secret) {
        int low = LOWER;
        int high = UPPER;
        int guesses = 0;

        while (low <= high) {
            int mid = low + (high - low) / 2;
            guesses++;

            if (mid == secret) {
                return new Result(secret, guesses);
            }

            if (mid < secret) {
                low = mid + 1;   // 密码在右半边
            } else {
                high = mid - 1;  // 密码在左半边
            }
        }

        return new Result(-1, guesses);
    }
}`
  },

  python: {
    label: 'Python',
    chip: 'Python 3',
    filename: 'binary_bomb.py',
    note: 'Python 的 // 是向下取整除法，天然适合计算 mid。用元组一次返回 secret 和 guesses；候选区间始终收缩，最多只需要约 log₂(100) ≈ 7 次。',
    code: `def crack_bomb(secret):
    low = 1
    high = 100
    guesses = 0

    while low <= high:
        mid = low + (high - low) // 2
        guesses += 1

        if mid == secret:
            return secret, guesses
        elif mid < secret:
            low = mid + 1   # 密码在右半边
        else:
            high = mid - 1  # 密码在左半边

    return None, guesses`
  },

  go: {
    label: 'Go',
    chip: 'Go 1.20+',
    filename: 'binary_bomb.go',
    note: 'Go 实现用结构体同时返回密码和次数；整数除法天然向下取整。low 与 high 都向区间内部收缩，secret 始终落在当前候选区间中。',
    code: `package binarysearch

type Result struct {
    Secret  int
    Guesses int
}

func CrackBomb(secret int) Result {
    low := 1
    high := 100
    guesses := 0

    for low <= high {
        mid := low + (high-low)/2
        guesses++

        if mid == secret {
            return Result{Secret: secret, Guesses: guesses}
        }

        if mid < secret {
            low = mid + 1 // 密码在右半边
        } else {
            high = mid - 1 // 密码在左半边
        }
    }

    return Result{Secret: -1, Guesses: guesses}
}`
  }
};
