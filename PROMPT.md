**Objective**
Build a highly interactive, educational multi-level cache simulator. The primary goals are modularity, logical consistency across configurable hierarchies (L1 to L3), and visual clarity achieved through progressive disclosure (toggle-able panels). Include a functional Light/Dark mode toggle (defaulting to Light).

**1. State Management & Data Structures**
The application must maintain a centralized, immutable state representing the entire memory hierarchy to handle cascading effects (e.g., an L1 eviction triggering an L2 write).

* **Memory State:** A limited, addressable memory array (e.g., 1024 words).
* **Hierarchy Config State:** An array representing 1 to 3 active cache levels. Each level object requires:
    * `levelName` (L1, L2, L3)
    * `totalSize` (bytes/words)
    * `blockSize` (bytes/words)
    * `associativity` (Direct Mapped [1], N-way set associative, Fully Associative)
    * `writeHitPolicy` (Write-Through, Write-Back)
    * `writeMissPolicy` (Write-Allocate, Write-No-Allocate)
* **Cache Content State:** For each active level, maintain an array of Sets. Each Set contains an array of Blocks (based on associativity). Each Block stores: `validBit`, `dirtyBit`, `tag`, `data` (array of words based on block size), and `lruCounter` (for replacement).
* **Statistics State:** Track total Hits, Misses, Evictions, and Hit Rate per cache level, plus global memory traffic (total reads/writes to main memory).

**2. Parameter Constraints & Enforcement**
The configuration UI must strictly enforce mathematical and architectural realities. If a user changes one variable, interdependent variables must update or restrict themselves accordingly:

* **Address Geometry:** Ensure `Total Size = Sets × Associativity × Block Size`. If the user tweaks one, auto-calculate or constrain the others to maintain powers of two.
* **Hierarchy Rules:** * $Block Size_{L(n+1)} \ge Block Size_{L(n)}$. (e.g., L2 block size cannot be smaller than L1 block size).
    * $Total Size_{L(n+1)} > Total Size_{L(n)}$.
* **Write Policy Sensibilities:** If `Write-Back` is selected, `Write-Allocate` is typically forced or highly recommended. If `Write-Through` is selected, `Write-No-Allocate` is standard. Allow overrides but flag them as "non-standard" to the user.

**3. Functional Action Flow (The Simulation Engine)**
Implement a stepped execution engine so the user can see the flow of data.

* **Read Operation:** * Check L1. If Hit -> update LRU, return.
    * If Miss -> Check L2 (if exists). If Hit -> pull block to L1 (handle L1 eviction if full), update LRU, return.
    * Cascade down to Memory.


* **Write Operation:**
    * Execute based on the specific `writeHit` and `writeMiss` policies of *each* level.
    * *Crucial:* Handle Write-Back evictions properly (a dirty block evicted from L1 must generate a write request to L2).



**4. UI Component Architecture (Structural Layout)**
To prioritize visual ease and prevent cognitive overload, the UI must rely heavily on collapsible panels and conditional rendering.

* **Global Control Bar (Always visible):** Light/Dark toggle, Play/Step/Reset controls, and the primary Input Field (Generate Read/Write request at specific memory address).
* **Hierarchy Builder Panel (Collapsible):** Toggles to enable L1, L2, L3. Dropdowns/Sliders for Size, Block Size, Associativity, and Write Policies.
* **Live Statistics Panel (Collapsible/Floating):** Real-time counters for hits, misses, and evictions per level.
* **Main Visualization Area (Tabbed or Stacked):**
    * Render each active cache level.
    * Only show the Sets and Blocks. Hide the actual binary `data` payload by default (use a "Show Data" toggle per block to save space).
    * Visually highlight the specific Set, Tag, and Block currently being accessed during an operation.
* **Main Memory Panel (Collapsible):** A scrolling list of memory blocks. Only render blocks that have been accessed or modified to save DOM nodes and screen space.

