'use strict';

/**
 * 源码解析面板使用的多语言实现。
 * 所有实现都基于同一套约定：
 * - 20 × 20 网格
 * - walls[y][x] 为 1 表示墙壁
 * - 四邻接，每次移动代价为 1
 * - 曼哈顿距离作为启发函数
 */
window.ASTAR_DOCS = {
  cpp: {
    label: 'C++',
    chip: 'C++17',
    filename: 'astar.cpp',
    note: 'priority_queue 默认是大根堆，所以比较器用 a.f > b.f 反过来得到小根堆。访问时同时检查 closed 和 g，可以跳过堆里残留的过期记录；路径先从终点回溯到起点，再用 reverse 翻转。',
    code: `#include <algorithm>
#include <cstdlib>
#include <queue>
#include <utility>
#include <vector>

using namespace std;

const int N = 20;
const int INF = 1000000000;
const int DX[4] = {1, -1, 0, 0};
const int DY[4] = {0, 0, 1, -1};

struct Node {
    int x, y;
    int g;  // 起点到当前格子的实际代价
    int f;  // f = g + h
};

struct Compare {
    // 让 f 更小的节点先出队
    bool operator()(const Node& a, const Node& b) const {
        return a.f > b.f;
    }
};

int heuristic(int x, int y, int gx, int gy) {
    return abs(x - gx) + abs(y - gy);
}

vector<pair<int, int>> aStar(
    const vector<vector<int>>& walls,
    pair<int, int> start,
    pair<int, int> goal
) {
    int sx = start.first, sy = start.second;
    int gx = goal.first, gy = goal.second;

    vector<vector<int>> g(N, vector<int>(N, INF));
    vector<vector<pair<int, int>>> parent(
        N, vector<pair<int, int>>(N, {-1, -1})
    );
    vector<vector<bool>> closed(N, vector<bool>(N, false));

    priority_queue<Node, vector<Node>, Compare> open;
    g[sy][sx] = 0;
    open.push({sx, sy, 0, heuristic(sx, sy, gx, gy)});

    while (!open.empty()) {
        Node current = open.top();
        open.pop();

        // 跳过已经扩展或已经过期的堆记录
        if (closed[current.y][current.x]) continue;
        if (current.g != g[current.y][current.x]) continue;

        closed[current.y][current.x] = true;

        if (current.x == gx && current.y == gy) {
            // 沿 parent 从终点回溯到起点
            vector<pair<int, int>> path;
            pair<int, int> p = goal;
            while (p.first != -1) {
                path.push_back(p);
                if (p.first == sx && p.second == sy) break;
                p = parent[p.second][p.first];
            }
            reverse(path.begin(), path.end());
            return path;
        }

        for (int d = 0; d < 4; ++d) {
            int nx = current.x + DX[d];
            int ny = current.y + DY[d];

            if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
            if (walls[ny][nx] == 1 || closed[ny][nx]) continue;

            int newG = current.g + 1;
            if (newG >= g[ny][nx]) continue;

            g[ny][nx] = newG;
            parent[ny][nx] = {current.x, current.y};

            int h = heuristic(nx, ny, gx, gy);
            open.push({nx, ny, newG, newG + h});
        }
    }

    return {};  // 起点与终点不连通
}`
  },

  java: {
    label: 'Java',
    chip: 'Java 17',
    filename: 'AStar.java',
    note: 'PriorityQueue 配合 lambda 比较器实现最小 f 优先。parent 把坐标编码成一个整数，减少对象分配；LinkedList.addFirst 让路径在回溯时天然形成正序。',
    code: `import java.util.*;

public class AStar {
    static final int N = 20;
    static final int INF = 1_000_000_000;
    static final int[] DX = {1, -1, 0, 0};
    static final int[] DY = {0, 0, 1, -1};

    static class Node {
        int x, y;
        int g;  // 起点到当前格子的实际代价
        int f;  // f = g + h

        Node(int x, int y, int g, int f) {
            this.x = x;
            this.y = y;
            this.g = g;
            this.f = f;
        }
    }

    static int heuristic(int x, int y, int gx, int gy) {
        return Math.abs(x - gx) + Math.abs(y - gy);
    }

    public static List<int[]> search(
        int[][] walls,
        int sx, int sy,
        int gx, int gy
    ) {
        int[][] g = new int[N][N];
        int[][] parent = new int[N][N];
        boolean[][] closed = new boolean[N][N];

        for (int y = 0; y < N; y++) {
            Arrays.fill(g[y], INF);
            Arrays.fill(parent[y], -1);
        }

        PriorityQueue<Node> open = new PriorityQueue<>(
            (a, b) -> Integer.compare(a.f, b.f)
        );

        g[sy][sx] = 0;
        open.add(new Node(sx, sy, 0, heuristic(sx, sy, gx, gy)));

        while (!open.isEmpty()) {
            Node current = open.poll();

            // 堆里可能有同一个格子的旧记录
            if (closed[current.y][current.x]) continue;
            if (current.g != g[current.y][current.x]) continue;

            closed[current.y][current.x] = true;

            if (current.x == gx && current.y == gy) {
                LinkedList<int[]> path = new LinkedList<>();
                int cx = gx;
                int cy = gy;

                while (true) {
                    path.addFirst(new int[]{cx, cy});
                    if (cx == sx && cy == sy) break;

                    int p = parent[cy][cx];
                    cx = p % N;
                    cy = p / N;
                }
                return path;
            }

            for (int d = 0; d < 4; d++) {
                int nx = current.x + DX[d];
                int ny = current.y + DY[d];

                if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
                if (walls[ny][nx] == 1 || closed[ny][nx]) continue;

                int newG = current.g + 1;
                if (newG >= g[ny][nx]) continue;

                g[ny][nx] = newG;
                parent[ny][nx] = current.y * N + current.x;

                int h = heuristic(nx, ny, gx, gy);
                open.add(new Node(nx, ny, newG, newG + h));
            }
        }

        return Collections.emptyList();
    }
}`
  },

  python: {
    label: 'Python',
    chip: 'Python 3',
    filename: 'astar.py',
    note: 'heapq 本身就是最小堆，把 (f, g, x, y) 元组压进去就会优先弹出 f 最小的节点。g_score 和 parent 用字典保存，未访问格子默认代价为无穷大，代码最短。',
    code: `from heapq import heappop, heappush
from math import inf

N = 20
DIRECTIONS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def heuristic(x, y, goal):
    return abs(x - goal[0]) + abs(y - goal[1])


def a_star(walls, start, goal):
    # walls[y][x] == 1 表示墙壁
    start = (start[0], start[1])
    goal = (goal[0], goal[1])

    g_score = {start: 0}
    parent = {}
    closed = set()

    # 元素顺序：(f, g, x, y)
    open_heap = [(heuristic(start[0], start[1], goal), 0, *start)]

    while open_heap:
        _, g, x, y = heappop(open_heap)
        current = (x, y)

        if current in closed:
            continue
        if g != g_score.get(current, inf):
            continue

        closed.add(current)
        if current == goal:
            return rebuild_path(parent, start, goal)

        for dx, dy in DIRECTIONS:
            nx, ny = x + dx, y + dy
            if not (0 <= nx < N and 0 <= ny < N):
                continue
            if walls[ny][nx] == 1 or (nx, ny) in closed:
                continue

            new_g = g + 1
            if new_g >= g_score.get((nx, ny), inf):
                continue

            g_score[(nx, ny)] = new_g
            parent[(nx, ny)] = current
            new_f = new_g + heuristic(nx, ny, goal)
            heappush(open_heap, (new_f, new_g, nx, ny))

    return []


def rebuild_path(parent, start, goal):
    path = [goal]
    current = goal

    while current != start:
        current = parent[current]
        path.append(current)

    path.reverse()
    return path`
  },

  go: {
    label: 'Go',
    chip: 'Go 1.20+',
    filename: 'astar.go',
    note: 'Go 标准库没有现成优先队列，需要实现 heap.Interface 的 Len、Less、Swap、Push、Pop。这里使用指针节点和惰性删除：重复入堆，弹出时通过 closed 与 g 检查过滤旧记录。',
    code: `package astar

import "container/heap"

const (
    gridSize = 20
    inf      = int(1e9)
)

type Point struct {
    X, Y int
}

type Node struct {
    X, Y int
    G    int // 起点到当前格子的实际代价
    F    int // f = g + h
}

// PriorityQueue 实现了 heap.Interface。
type PriorityQueue []*Node

func (pq PriorityQueue) Len() int {
    return len(pq)
}

func (pq PriorityQueue) Less(i, j int) bool {
    if pq[i].F == pq[j].F {
        // f 相同时优先扩展更接近终点的节点
        return pq[i].G > pq[j].G
    }
    return pq[i].F < pq[j].F
}

func (pq PriorityQueue) Swap(i, j int) {
    pq[i], pq[j] = pq[j], pq[i]
}

func (pq *PriorityQueue) Push(x interface{}) {
    *pq = append(*pq, x.(*Node))
}

func (pq *PriorityQueue) Pop() interface{} {
    old := *pq
    n := len(old)
    item := old[n-1]
    *pq = old[:n-1]
    return item
}

var dirs = [4][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}}

func absInt(value int) int {
    if value < 0 {
        return -value
    }
    return value
}

func heuristic(x, y int, goal Point) int {
    return absInt(x-goal.X) + absInt(y-goal.Y)
}

func AStar(walls [][]bool, start, goal Point) []Point {
    g := make([][]int, gridSize)
    parent := make([][]Point, gridSize)
    closed := make([][]bool, gridSize)

    for y := 0; y < gridSize; y++ {
        g[y] = make([]int, gridSize)
        parent[y] = make([]Point, gridSize)
        closed[y] = make([]bool, gridSize)

        for x := 0; x < gridSize; x++ {
            g[y][x] = inf
            parent[y][x] = Point{X: -1, Y: -1}
        }
    }

    open := &PriorityQueue{}
    heap.Init(open)

    g[start.Y][start.X] = 0
    heap.Push(open, &Node{
        X: start.X,
        Y: start.Y,
        G: 0,
        F: heuristic(start.X, start.Y, goal),
    })

    for open.Len() > 0 {
        current := heap.Pop(open).(*Node)

        // 过滤已扩展或过期的记录
        if closed[current.Y][current.X] {
            continue
        }
        if current.G != g[current.Y][current.X] {
            continue
        }

        closed[current.Y][current.X] = true

        if current.X == goal.X && current.Y == goal.Y {
            path := []Point{}
            point := goal

            for {
                path = append(path, point)
                if point == start {
                    break
                }
                point = parent[point.Y][point.X]
            }

            for i, j := 0, len(path)-1; i < j; i, j = i+1, j-1 {
                path[i], path[j] = path[j], path[i]
            }
            return path
        }

        for _, direction := range dirs {
            nx := current.X + direction[0]
            ny := current.Y + direction[1]

            if nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize {
                continue
            }
            if walls[ny][nx] || closed[ny][nx] {
                continue
            }

            newG := current.G + 1
            if newG >= g[ny][nx] {
                continue
            }

            g[ny][nx] = newG
            parent[ny][nx] = Point{X: current.X, Y: current.Y}

            heap.Push(open, &Node{
                X: nx,
                Y: ny,
                G: newG,
                F: newG + heuristic(nx, ny, goal),
            })
        }
    }

    return []Point{} // 起点与终点不连通
}`
  }
};
