"use client";

import { useMemo, useState } from "react";

type Lens = "sandwich" | "attention" | "homp" | "gccn" | "motifs" | "raiseLower" | "dynamics";
type TermKey = "G" | "H" | "W" | "K" | "hadamard" | "A" | "transpose" | "messageFn" | "message" | "neighborAttention" | "intra" | "channelAttention" | "inter" | "update" | "complex" | "viewGraph" | "subtensor" | "omega" | "rankAggregate" | "layer" | "readout" | "motifRoute" | "motifLoop" | "motifAttention" | "motifParallel" | "motifFFL" | "motifNull" | "boundary" | "coboundary" | "lowerLap" | "upperLap" | "hodge" | "harmonic" | "restriction" | "extension" | "derivative" | "localDynamics" | "gate" | "transport" | "flux" | "memory" | "source" | "sink" | "rank" | "timescale" | "stalk";

type TermInfo = { symbol: string; name: string; family: string; meaning: string; action: string; contrast: string; color: string };

const termInfo: Record<TermKey, TermInfo> = {
  G: { symbol: "Gⱼ←ᵢ", name: "structural / cochain map", family: "topology · left operator", meaning: "Says which rank-i cells are allowed to contribute to each rank-j cell.", action: "Left-multiplies H: changes the object/cell axis nᵢ → nⱼ, while leaving feature width alone.", contrast: "It routes between cells. It does not learn how feature channels should mix.", color: "cyan" },
  H: { symbol: "Hᵢ", name: "input cochain / signal tensor", family: "state · central tensor", meaning: "One feature row for every rank-i cell: neurons, edges, assemblies, faces, or another chosen object type.", action: "Shape nᵢ × dᵢ. Rows are cells; columns are feature channels.", contrast: "H is what is being transformed—not the wiring and not the learned feature mixer.", color: "yellow" },
  W: { symbol: "Wᵢ→ⱼ", name: "learned feature transform", family: "parameters · right operator", meaning: "Learns how input feature channels should be recombined into output feature channels.", action: "Right-multiplies H: changes feature width dᵢ → dⱼ, while leaving the cell axis alone.", contrast: "It mixes representation coordinates. It does not decide which cells are neighbors.", color: "pink" },
  K: { symbol: "Kⱼ", name: "output cochain", family: "state · result", meaning: "The transformed signal now supported on rank-j cells.", action: "Shape nⱼ × dⱼ: the left operator chose the output cells; the right operator chose the output features.", contrast: "It is a new cochain, not necessarily an in-place update of Hᵢ.", color: "yellow" },
  hadamard: { symbol: "⊙", name: "Hadamard mask", family: "composition · entrywise", meaning: "Multiplies the structural operator and attention matrix entry by entry.", action: "Preserves G’s shape and support: attention can reweight an allowed route, but cannot create a route where G is zero.", contrast: "This is not ordinary matrix multiplication.", color: "neutral" },
  A: { symbol: "Aₛ→ₜ", name: "cross-rank attention matrix", family: "attention · route weights", meaning: "Scores which permitted source cells matter to each target cell at this moment.", action: "Has the same nₜ × nₛ shape and nonzero pattern as Gₜ←ₛ; G ⊙ A becomes a learned structural operator.", contrast: "Attention answers how much to listen—not how to translate between incompatible feature spaces.", color: "orange" },
  transpose: { symbol: "Gᵀ", name: "reverse structural direction", family: "topology · reverse route", meaning: "Uses the transposed incidence relation to send information in the opposite rank direction.", action: "If G maps s-cells to t-cells, Gᵀ maps t-cells back to s-cells.", contrast: "Reverse connectivity need not imply tied attention or identical semantics.", color: "cyan" },
  messageFn: { symbol: "α𝒩ₖ(·,·)", name: "typed message function", family: "HOMP · message construction", meaning: "Builds a message from receiver x, sender y, and the neighborhood type 𝒩ₖ.", action: "Can use cell features, orientation, union/intersection information, or another relation-specific input.", contrast: "Despite the letter α, this is the book’s message function—not the later attention weight aᵏ(x,y).", color: "purple" },
  message: { symbol: "mₓ,ᵧ", name: "individual message", family: "HOMP · carried content", meaning: "The content sent from y to x through one typed neighborhood relation.", action: "It is computed before neighbors or neighborhood channels are aggregated.", contrast: "A message is carried content; an attention coefficient is a gate on that content.", color: "purple" },
  neighborAttention: { symbol: "aᵏ(x,y)", name: "within-neighborhood attention", family: "attention · who matters", meaning: "Weights one neighbor y among all neighbors reached through relation type k.", action: "Answers: within this channel, which sender should x listen to?", contrast: "It is distinct from bᵏ, which compares entire neighborhood types.", color: "orange" },
  intra: { symbol: "⊕", name: "intra-neighborhood aggregation", family: "HOMP · gather within channel", meaning: "Combines all weighted messages arriving through one neighborhood 𝒩ₖ.", action: "Usually permutation-invariant: sum, mean, max, or a learned invariant set function.", contrast: "It gathers senders inside one channel; ⊗ merges the channels afterward.", color: "green" },
  channelAttention: { symbol: "bᵏ", name: "between-neighborhood attention", family: "attention · which relation matters", meaning: "Weights an entire communication channel such as incidence, upper adjacency, or temporal coupling.", action: "Answers: should x rely more on synaptic, assembly, anatomical, or another neighborhood type?", contrast: "This second attention level is particular to multi-neighborhood higher-order message passing.", color: "orange" },
  inter: { symbol: "⊗", name: "inter-neighborhood aggregation", family: "HOMP · merge channels", meaning: "Combines the already-aggregated outputs of different neighborhood types.", action: "May concatenate, sum, or use an ordered learned merge; it need not be permutation-invariant.", contrast: "This denotes a generic channel merge here—not necessarily a literal Kronecker product.", color: "green" },
  update: { symbol: "β(·,·)", name: "state update", family: "HOMP · writeback", meaning: "Combines the old state of x with the merged incoming message.", action: "Produces hₓ⁽ˡ⁺¹⁾, often through an MLP, gated update, normalization, or residual block.", contrast: "Aggregation decides what arrived; β decides how the receiver changes.", color: "pink" },
  complex: { symbol: "𝒞", name: "one combinatorial complex", family: "GCCN · original domain", meaning: "The single higher-order object containing all cells and their ranks: nodes, edges, faces, or other cell types.", action: "Supplies the shared cell identities from which every neighborhood-specific graph view is derived.", contrast: "TopoTune does not begin with three unrelated datasets. The graph views are overlapping projections of this same complex.", color: "yellow" },
  viewGraph: { symbol: "𝒢𝒩", name: "strictly augmented Hasse graph", family: "GCCN · one relation view", meaning: "A standard directed graph induced by one neighborhood rule 𝒩. Its graph-nodes are cells of 𝒞; its graph-edges are permitted 𝒩-relations.", action: "Turns one typed relation—node adjacency, edge adjacency, face→edge incidence, and so on—into a graph that an ordinary graph model can process.", contrast: "𝒢𝒩 is not the original complex and its graph-nodes need not be rank-0 nodes; an edge-cell or face-cell can become a node in this derived graph.", color: "cyan" },
  subtensor: { symbol: "H𝒩ˡ", name: "view-specific feature slice", family: "GCCN · state on one graph view", meaning: "The rows of the global cell-feature matrix belonging to cells that occur in 𝒢𝒩 at layer l.", action: "Feeds the same cell’s current embedding into every graph view in which that cell participates.", contrast: "The subscript 𝒩 names a neighborhood view; the superscript l names network depth. Neither is the combinatorial rank.", color: "yellow" },
  omega: { symbol: "ω𝒩", name: "neighborhood-specific processor", family: "GCCN · independent base model", meaning: "A learnable graph-to-graph feature map applied only to 𝒢𝒩 and H𝒩ˡ.", action: "May be GCN, GAT, GIN, GraphSAGE, Transformer, or another compatible model; different views may use separate parameters.", contrast: "ω𝒩 is an entire processing block, not merely the right-hand feature matrix W from K=GHW.", color: "pink" },
  rankAggregate: { symbol: "⊗rank", name: "cell-aligned inter-neighborhood merge", family: "GCCN · synchronization", meaning: "Combines multiple view-specific proposals that refer to the same destination cell and rank.", action: "For edge e₂₃, it can merge an edge↔edge proposal with a face→edge proposal before writing one updated embedding for e₂₃.", contrast: "Despite the figure’s label ‘rank-level aggregation,’ this is not indiscriminate pooling of every edge. It aligns by cell identity, then merges channels targeting that cell.", color: "green" },
  layer: { symbol: "l→l+1", name: "network-depth transition", family: "GCCN · repeated computation", meaning: "One complete expand/process/synchronize/update pass produces the states used by the next pass.", action: "After merging, the updated global cell matrix is sliced again into H𝒩ˡ for each view in the following GCCN layer.", contrast: "Layer number l is not topological rank. A rank-2 face may be processed at every neural-network layer.", color: "violet" },
  readout: { symbol: "R", name: "task readout", family: "GCCN · prediction head", meaning: "Converts final cell embeddings into the requested prediction: graph/complex label, node label, edge score, or regression output.", action: "A graph-level task may pool cells or ranks; a cell-level task may read only the relevant rank.", contrast: "Readout happens after message passing. It should not be confused with rank-level synchronization inside every GCCN layer.", color: "purple" },
  motifRoute: { symbol: "→", name: "routing motif", family: "motif atlas · structural path", meaning: "A small reusable pattern specifying which cell type sends to which other cell type: up, down, sideways, or out-and-back.", action: "The associated incidence or adjacency operator fixes the legal support of a message before any learned weighting.", contrast: "In Papillon’s diagram this is an architecture primitive. In Uri Alon’s sense, a motif must also be statistically overrepresented in a biological network relative to a null ensemble.", color: "cyan" },
  motifLoop: { symbol: "↺", name: "loop / recurrence motif", family: "motif atlas · state memory", meaning: "Feeds a cell’s previous state—or another cell’s response—back into an update.", action: "A neural self-loop provides residual memory; biological positive feedback can stabilize an ON state, while negative feedback can restore homeostasis or generate oscillation.", contrast: "The same loop shape does not imply the same dynamics: its sign, delay, nonlinearity, and gain decide the behavior.", color: "violet" },
  motifAttention: { symbol: "α / ⌒", name: "attention overlay", family: "motif atlas · conditional gain", meaning: "Reweights an already legal route according to the current sender and receiver states; multiple arcs denote multiple attention heads.", action: "Lets the same wiring diagram transmit differently in different contexts without rewiring the domain.", contrast: "Attention is usually a computation painted onto an edge, not a network motif in the Uri Alon statistical-subgraph sense.", color: "orange" },
  motifParallel: { symbol: "P / ⊗", name: "parallel paths and channel merge", family: "motif atlas · composition", meaning: "Processes several routes or neighborhood types independently, then sums, concatenates, or otherwise aggregates their proposals.", action: "Prevents node, edge, face, lower, and upper evidence from becoming indistinguishable before the model can compare them.", contrast: "Parallel computational channels may resemble a bi-fan or multi-input biological circuit, but channel aggregation is an architectural operation rather than a biochemical interaction.", color: "green" },
  motifFFL: { symbol: "X→Y→Z; X→Z", name: "feed-forward loop", family: "Uri Alon · three-node circuit", meaning: "A regulator reaches a target by one direct path and one indirect path through a second regulator.", action: "If the path signs agree, a coherent FFL can reject brief inputs and create a sign-sensitive delay; if they disagree, an incoherent FFL can accelerate responses, pulse, or support fold-change detection.", contrast: "A TDL two-path computation becomes an Alon-style FFL only when the nodes and signed arrows are actual regulatory entities and interactions—not merely tensors and operators.", color: "pink" },
  motifNull: { symbol: "Zmotif", name: "motif enrichment test", family: "Uri Alon · statistical criterion", meaning: "Compares the count of a small subgraph in the observed biological network with counts in randomized networks that preserve chosen low-order properties.", action: "Distinguishes a recurring, selected circuit pattern from an anecdotal shape drawn once.", contrast: "Choosing a null model is substantive: preserving degree sequence, signs, directions, and higher-order membership can change which motifs appear enriched.", color: "yellow" },
  boundary: { symbol: "Bₖ", name: "boundary / lowering operator", family: "rank map · k → k−1", meaning: "Sends each oriented k-cell to its signed collection of boundary faces.", action: "For edge signals, B₁ moves edge flow onto vertices as signed divergence. It changes rank, so it is not by itself an endomorphism of Cᵏ.", contrast: "This is an incidence map inside one complex—not a functorial push-forward between two spaces.", color: "cyan" },
  coboundary: { symbol: "Bₖᵀ", name: "coboundary / raising adjoint", family: "rank map · k−1 → k", meaning: "Reads the same incidence matrix in the opposite direction, lifting lower-rank values onto incident higher-rank cells.", action: "For vertex potentials, B₁ᵀ produces oriented edge differences: a discrete gradient.", contrast: "It is the adjoint of Bₖ under the chosen inner products; that does not make it a categorical pullback.", color: "pink" },
  lowerLap: { symbol: "Lₖ↓ = BₖᵀBₖ", name: "lower Hodge Laplacian", family: "round trip · down then up", meaning: "Compares k-cells through shared (k−1)-faces: edges meet through vertices, faces meet through edges.", action: "First lower with Bₖ, then raise with Bₖᵀ. The result acts back on the original rank k.", contrast: "The word lower describes the neighborhood used, not the final output rank.", color: "cyan" },
  upperLap: { symbol: "Lₖ↑ = Bₖ₊₁Bₖ₊₁ᵀ", name: "upper Hodge Laplacian", family: "round trip · up then down", meaning: "Compares k-cells through shared (k+1)-cofaces: edges co-bound a face, faces co-bound a volume.", action: "First raise with Bₖ₊₁ᵀ, then lower with Bₖ₊₁. The result again acts on rank k.", contrast: "Upper adjacency exists only when the higher-rank filling cell is actually present.", color: "pink" },
  hodge: { symbol: "Lₖ = Lₖ↓ + Lₖ↑", name: "Hodge Laplacian", family: "same-rank closure · additive merge", meaning: "Adds the two legal incidence round trips around rank k.", action: "It is the canonical symmetric diffusion operator, but a neural architecture may keep the channels separate, weight them, or use only one.", contrast: "Bidirectionality is forced for this same-rank round trip—not for every possible cross-rank neural update.", color: "green" },
  harmonic: { symbol: "ker Lₖ", name: "harmonic subspace", family: "TDA · topology that diffusion leaves still", meaning: "Signals annihilated by both lower and upper Hodge terms. Its dimension is the k-th Betti number.", action: "On an unfilled triangle, uniform circulation is harmonic; adding the face activates the upper term and destroys that 1-dimensional hole.", contrast: "Pure Laplacian diffusion cannot move a harmonic mode, but residual channels or explicit harmonic features can preserve and use it—message passing is not universally blind to topology.", color: "violet" },
  restriction: { symbol: "ι*", name: "cochain restriction", family: "filtration map · large → small", meaning: "For an inclusion Xₛ ⊂ Xₜ, forgets values on cells that do not exist in Xₛ.", action: "This is canonical and commutes with the coboundary, so it is a genuine contravariant cochain map.", contrast: "This horizontal map between complexes is categorically different from B and Bᵀ moving vertically between ranks inside one complex.", color: "purple" },
  extension: { symbol: "ext₀", name: "extension by zero", family: "filtration lift · small → large", meaning: "Copies an old cochain into the larger complex and assigns zero to newly added cells.", action: "It is a tempting fine-scale lift, but generally fails to commute with the coboundary when new cells have old faces.", contrast: "Fine → coarse restriction is canonical; coarse → fine extension requires a modeling choice, transport, interpolation, or learned map.", color: "red" },
  derivative: { symbol: "ḣᵣ", name: "state velocity", family: "dynamics · left-hand side", meaning: "The instantaneous rate of change of the state carried at scale or rank r.", action: "Turns a feed-forward message-passing picture into an explicit dynamical system.", contrast: "A layer update approximates dynamics; a derivative asserts a time-evolution model.", color: "yellow" },
  localDynamics: { symbol: "fᵣ(hᵣ)", name: "within-scale dynamics", family: "dynamics · endogenous", meaning: "What scale r would do under its own local evolution before cross-scale influence.", action: "Can encode decay, oscillation, reaction, recurrence, or a learned local vector field.", contrast: "It is not cross-rank routing; it stays within the same state space.", color: "violet" },
  gate: { symbol: "αₛᵣ(t)", name: "dynamic gate", family: "attention · when/how much", meaning: "Controls how strongly the s→r pathway matters at time t.", action: "Modulates a route without specifying the route, translation, or transported quantity.", contrast: "Importance is not flux: a large gate can multiply a small message.", color: "orange" },
  transport: { symbol: "Tₛᵣ", name: "transport / restriction map", family: "sheaf-like · translation", meaning: "Translates a message from the source representation space into the receiver’s representation space.", action: "Answers: how should r interpret a signal expressed in s’s local coordinates?", contrast: "This learned local translation is extra structure beyond a plain CC cochain map G.", color: "purple" },
  flux: { symbol: "mₛᵣ or Jₛ→ᵣ", name: "message / physical flux", family: "content · what moves", meaning: "The actual content carried across a route: activity, information, energy, momentum, or another state-dependent quantity.", action: "In a conservative model, directional fluxes can appear with matching inflow and outflow terms.", contrast: "A learned message may only resemble a flux; physical flux requires units, conservation, and balance laws.", color: "purple" },
  memory: { symbol: "Mᵣ[h(τ<t)]", name: "memory kernel", family: "multiscale · unresolved history", meaning: "Carries delayed influence of past states, often induced when fast or unresolved variables are eliminated.", action: "Makes the effective evolution of the resolved state non-Markovian.", contrast: "Ordinary instantaneous message passing does not automatically include this history dependence.", color: "violet" },
  source: { symbol: "Sᵣ", name: "source / generator", family: "balance law · injection", meaning: "Adds a tracked quantity at scale r: forcing, drive, production, or external input.", action: "Raises the balance independently of transfer from other scales.", contrast: "A source creates or injects; an incoming flux transfers what already exists elsewhere.", color: "green" },
  sink: { symbol: "Dᵣ", name: "sink / dissipation", family: "balance law · removal", meaning: "Removes a tracked quantity through decay, damping, dissipation, leakage, or consumption.", action: "Appears with a negative sign in a balance equation.", contrast: "A sink removes; an outgoing flux merely moves the quantity to another represented scale.", color: "red" },
  rank: { symbol: "r", name: "combinatorial rank", family: "structure · what kind of cell", meaning: "Labels object type or hierarchical level in the complex: vertices, edges, faces, assemblies, regions, and so on.", action: "Determines which cochain space supports the signal and which structural maps can act on it.", contrast: "Higher rank does not automatically mean slower dynamics or larger physical length scale.", color: "cyan" },
  timescale: { symbol: "τᵣ", name: "characteristic timescale", family: "dynamics · fast versus slow", meaning: "Measures how quickly variables at a chosen level evolve or relax.", action: "Supports multirate integration, singular perturbation, homogenization, or memory-aware closures.", contrast: "Timescale is additional physics; it is not supplied merely by assigning a combinatorial rank.", color: "violet" },
  stalk: { symbol: "Vₓ", name: "local feature space / stalk", family: "sheaf-like · representational language", meaning: "Specifies what kind of vector can live at object x and what its coordinates mean.", action: "Allows different objects or ranks to carry genuinely different local representation spaces.", contrast: "Feature-space mismatch is not solved solely by knowing which cells are incident.", color: "purple" },
};

const lensNames: Record<Lens, { short: string; title: string; note: string }> = {
  sandwich: { short: "Operator sandwich", title: "One multiplication, two entirely different axes", note: "Left operators move information among cells; right operators remix the features inside each cell." },
  attention: { short: "Cross-rank attention", title: "Topology supplies the routes; attention reweights them", note: "The CC-attention block can move signals in both directions between unequal ranks without flattening the ranks together." },
  homp: { short: "HOMP pipeline", title: "Build → gather → merge → update", note: "HOMP has two nested aggregation levels: neighbors inside a relation, then relation-types around the receiver." },
  gccn: { short: "GCCN pathway", title: "One complex → typed graph views → synchronized cell updates", note: "Unpack the TopoTune diagram into concrete cells: each view proposes an update, then proposals for the same underlying cell are aligned and merged." },
  motifs: { short: "Motif atlas", title: "Recurring computation shapes—and what they mean biologically", note: "Decode the graphical literature review into reusable TDL primitives, then compare each with Uri Alon’s signed regulatory network motifs." },
  raiseLower: { short: "Raise + lower", title: "Leave a rank, come back, then add the two routes", note: "A one-way incidence map changes rank. A Hodge operator closes the trip around rank k: down→up plus up→down." },
  dynamics: { short: "Multiscale dynamics", title: "Routing + translation + flux + memory", note: "A broader synthesis—not standard HOMP. It separates jobs that a homogeneous message-passing graph often blends together." },
};

function MathTerm({ id, children, selected, onSelect, compact = false }: { id: TermKey; children: React.ReactNode; selected: TermKey; onSelect: (id: TermKey) => void; compact?: boolean }) {
  const info = termInfo[id];
  return <button type="button" className={`math-term term-${info.color} ${selected === id ? "is-selected" : ""} ${compact ? "compact" : ""}`} aria-pressed={selected === id} aria-label={`${info.symbol}: ${info.name}`} onClick={(event) => { event.stopPropagation(); onSelect(id); }}>{children}</button>;
}

const pretty = (value: number) => Number(value.toFixed(2));

function OperatorSandwich({ selected, setSelected }: { selected: TermKey; setSelected: (id: TermKey) => void }) {
  const [trace, setTrace] = useState(0);
  const traceIds: TermKey[] = ["H", "G", "W", "K"];
  const sourceFeatures = [[1, .5], [.4, 1.2], [-.2, .9], [1.1, -.3]];
  const routes = [[1, 1, 0, 1], [0, 1, 1, 0]];
  const mixer = [[.8, -.4], [.2, 1.1]];
  const mixed = sourceFeatures.map(row => [pretty(row[0] * mixer[0][0] + row[1] * mixer[1][0]), pretty(row[0] * mixer[0][1] + row[1] * mixer[1][1])]);
  const output = routes.map(row => [0, 1].map(channel => pretty(row.reduce((sum, route, i) => sum + route * mixed[i][channel], 0))));
  const advance = () => { const next = (trace + 1) % traceIds.length; setTrace(next); setSelected(traceIds[next]); };
  return <div className="work-area">
    <div className="equation-stage" aria-label="Interactive operator sandwich equation">
      <div className="equation-kicker">CC convolutional push-forward · Eq. 5.3</div>
      <div className="equation equation-xl">
        <MathTerm id="K" selected={selected} onSelect={setSelected}>K<sub>j</sub></MathTerm><span>=</span>
        <MathTerm id="G" selected={selected} onSelect={setSelected}>G<sub>j←i</sub></MathTerm>
        <MathTerm id="H" selected={selected} onSelect={setSelected}>H<sub>i</sub></MathTerm>
        <MathTerm id="W" selected={selected} onSelect={setSelected}>W<sub>i→j</sub></MathTerm>
      </div>
      <div className="dimension-chain" aria-label="Matrix dimensions">
        <div className="dimension dim-yellow"><b>Kⱼ</b><span>nⱼ × dⱼ</span></div><span>=</span>
        <div className="dimension dim-cyan"><b>Gⱼ←ᵢ</b><span>nⱼ × nᵢ</span></div><span>×</span>
        <div className="dimension dim-yellow"><b>Hᵢ</b><span>nᵢ × dᵢ</span></div><span>×</span>
        <div className="dimension dim-pink"><b>Wᵢ→ⱼ</b><span>dᵢ × dⱼ</span></div>
      </div>
      <div className="axis-explainer">
        <div className="axis-line cells"><span>LEFT</span><i/><p><b>cell axis</b> nᵢ → nⱼ</p></div>
        <div className="axis-line features"><p><b>feature axis</b> dᵢ → dⱼ</p><i/><span>RIGHT</span></div>
      </div>
      <button className="trace-button" type="button" onClick={advance}>Trace signal · {trace + 1}/4</button>
    </div>
    <section className="synthetic-panel" aria-label="Synthetic operator sandwich message passing example">
      <div className="synthetic-head"><div><span className="toy-badge">synthetic data</span><h3>Four neurons → two assemblies</h3></div><p>Follow the same values through cell routing and feature mixing.</p></div>
      <div className={`sandwich-graph trace-${trace}`}>
        <svg viewBox="0 0 700 275" role="img" aria-label="Bipartite graph of four neuron cells sending features into two assembly cells">
          <defs><marker id="sandwich-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
          <g className="toy-routes" onClick={() => setSelected("G")}>
            {routes.flatMap((row, target) => row.map((route, source) => route ? <line key={`${source}-${target}`} x1="165" y1={45 + source * 62} x2="535" y2={91 + target * 105} markerEnd="url(#sandwich-arrow)"/> : null))}
          </g>
          <g className="toy-mixer" onClick={() => setSelected("W")}><rect x="303" y="102" width="94" height="68" rx="12"/><text x="350" y="129">W mixes</text><text x="350" y="149">2 features</text></g>
          {sourceFeatures.map((features, i) => <g key={i} className="toy-source" onClick={() => setSelected("H")}><circle cx="112" cy={45 + i * 62} r="30"/><text x="112" y={41 + i * 62}>n{i + 1}</text><text className="toy-value" x="112" y={59 + i * 62}>[{features.join(", ")}]</text></g>)}
          {output.map((features, i) => <g key={i} className="toy-target" onClick={() => setSelected("K")}><rect x="548" y={56 + i * 105} width="116" height="70" rx="16"/><text x="606" y={82 + i * 105}>assembly a{i + 1}</text><text className="toy-value" x="606" y={104 + i * 105}>[{features.join(", ")}]</text></g>)}
          <text className="toy-axis-label" x="112" y="268">H: rows are source cells</text><text className="toy-axis-label" x="350" y="194">W acts at every source</text><text className="toy-axis-label" x="606" y="268">K = routed sums</text>
        </svg>
      </div>
      <div className="calc-strip four"><button type="button" className={trace === 0 ? "active yellow" : ""} onClick={() => { setTrace(0); setSelected("H"); }}><span>1 · features</span><b>H₁ = [1, 0.5]</b><small>two channels on neuron 1</small></button><button type="button" className={trace === 1 ? "active cyan" : ""} onClick={() => { setTrace(1); setSelected("G"); }}><span>2 · routes</span><b>a₁ ← n₁,n₂,n₄</b><small>binary structural mask G</small></button><button type="button" className={trace === 2 ? "active pink" : ""} onClick={() => { setTrace(2); setSelected("W"); }}><span>3 · remix</span><b>H₁W = [{mixed[0].join(", ")}]</b><small>same source, new channels</small></button><button type="button" className={trace === 3 ? "active green" : ""} onClick={() => { setTrace(3); setSelected("K"); }}><span>4 · aggregate</span><b>K₁ = [{output[0].join(", ")}]</b><small>sum the three routed rows</small></button></div>
    </section>
    <div className="sandwich-grid">
      <button type="button" className={`mini-matrix matrix-g ${selected === "G" ? "active" : ""}`} onClick={() => setSelected("G")}><span>G acts down the rows</span><b>⎡1 0 1⎤<br/>⎢0 1 1⎥<br/>⎣1 1 0⎦</b><small>which cells talk</small></button>
      <button type="button" className={`mini-matrix matrix-h ${selected === "H" ? "active" : ""}`} onClick={() => setSelected("H")}><span>H carries the signal</span><b>⎡h₁₁ ··· h₁d⎤<br/>⎢ &nbsp; ⋮ &nbsp; ⋱ &nbsp; ⋮ ⎥<br/>⎣hₙ₁ ··· hₙd⎦</b><small>cells × features</small></button>
      <button type="button" className={`mini-matrix matrix-w ${selected === "W" ? "active" : ""}`} onClick={() => setSelected("W")}><span>W acts across columns</span><b>⎡w₁₁ ··· w₁q⎤<br/>⎢ &nbsp; ⋮ &nbsp; ⋱ &nbsp; ⋮ ⎥<br/>⎣wₚ₁ ··· wₚq⎦</b><small>how features mix</small></button>
    </div>
  </div>;
}

function AttentionView({ selected, setSelected }: { selected: TermKey; setSelected: (id: TermKey) => void }) {
  const [up, setUp] = useState(true);
  const edgeState = [.8, .3, 1.1, .5];
  const faceState = [.9, 1.2];
  const weights = [[.6, .25, .15, 0], [0, .2, .55, .25]];
  const faceOutput = weights.map(row => pretty(row.reduce((sum, weight, i) => sum + weight * edgeState[i], 0)));
  const edgeOutput = edgeState.map((_, edge) => pretty(weights.reduce((sum, row, face) => sum + row[edge] * faceState[face], 0)));
  const sourceValues = up ? edgeState : faceState;
  const targetValues = up ? faceOutput : edgeOutput;
  return <div className="work-area">
    <div className="direction-controls" role="group" aria-label="Cross-rank direction"><button type="button" className={up ? "active" : ""} onClick={() => setUp(true)}>s → t · push up</button><button type="button" className={!up ? "active" : ""} onClick={() => setUp(false)}>t → s · pull down</button></div>
    <div className="equation-stage attention-stage">
      <div className="equation-kicker">CC attention push-forward · unequal ranks · Eq. 5.5</div>
      <div className="equation equation-lg">
        <MathTerm id="K" selected={selected} onSelect={setSelected}>K<sub>{up ? "t" : "s"}</sub></MathTerm><span>= (</span>
        <MathTerm id={up ? "G" : "transpose"} selected={selected} onSelect={setSelected}>{up ? <>G<sub>t←s</sub></> : <>G<sup>T</sup><sub>s←t</sub></>}</MathTerm>
        <MathTerm id="hadamard" selected={selected} onSelect={setSelected}>⊙</MathTerm>
        <MathTerm id="A" selected={selected} onSelect={setSelected}>A<sub>{up ? "s→t" : "t→s"}</sub></MathTerm><span>)</span>
        <MathTerm id="H" selected={selected} onSelect={setSelected}>H<sub>{up ? "s" : "t"}</sub></MathTerm>
        <MathTerm id="W" selected={selected} onSelect={setSelected}>W<sub>{up ? "s→t" : "t→s"}</sub></MathTerm>
      </div>
      <p className="equation-caption"><span className="cyan">G</span> is the permission mask. <span className="orange">A</span> is the learned volume knob on each permitted route.</p>
    </div>
    <section className="synthetic-panel attention-toy" aria-label="Synthetic cross-rank attention graph">
      <div className="synthetic-head"><div><span className="toy-badge">synthetic data</span><h3>{up ? "Edges attend into faces" : "Faces attend back into edges"}</h3></div><p>Line width is the learned attention weight; absent lines are forbidden by G.</p></div>
      <svg viewBox="0 0 760 300" role="img" aria-label={up ? "Four edge cells send weighted messages to two face cells" : "Two face cells send weighted messages to four edge cells"}>
        <defs><marker id="attention-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
        <g className={`weighted-routes ${up ? "up" : "down"}`} onClick={() => setSelected("A")}>
          {weights.flatMap((row, face) => row.map((weight, edge) => weight > 0 ? <g key={`${face}-${edge}`}><line x1={up ? 150 : 610} y1={up ? 50 + edge * 67 : 105 + face * 100} x2={up ? 610 : 150} y2={up ? 105 + face * 100 : 50 + edge * 67} style={{ strokeWidth: 2 + weight * 10, opacity: .38 + weight * .75 }} markerEnd="url(#attention-arrow)"/><text x="380" y={(50 + edge * 67 + 105 + face * 100) / 2 - 4}>α={weight}</text></g> : null))}
        </g>
        {(up ? edgeState : faceState).map((value, i) => <g key={`source-${i}`} className="attention-source" onClick={() => setSelected("H")}><rect x={up ? 67 : 563} y={(up ? 24 + i * 67 : 75 + i * 100)} width="112" height="52" rx="13"/><text x={up ? 123 : 619} y={(up ? 45 + i * 67 : 96 + i * 100)}>{up ? `edge e${i + 1}` : `face f${i + 1}`}</text><text className="toy-value" x={up ? 123 : 619} y={(up ? 64 + i * 67 : 115 + i * 100)}>h = {value}</text></g>)}
        {(up ? faceOutput : edgeOutput).map((value, i) => <g key={`target-${i}`} className="attention-target" onClick={() => setSelected("K")}><rect x={up ? 563 : 67} y={(up ? 75 + i * 100 : 24 + i * 67)} width="112" height="52" rx="13"/><text x={up ? 619 : 123} y={(up ? 96 + i * 100 : 45 + i * 67)}>{up ? `face f${i + 1}` : `edge e${i + 1}`}</text><text className="toy-value" x={up ? 619 : 123} y={(up ? 115 + i * 100 : 64 + i * 67)}>k = {value}</text></g>)}
        <text className="toy-axis-label" x="123" y="292">{up ? "rank 1 source cochain" : "rank 1 output cochain"}</text><text className="toy-axis-label" x="619" y="292">{up ? "rank 2 output cochain" : "rank 2 source cochain"}</text>
      </svg>
      <div className="message-readout"><button type="button" onClick={() => setSelected("G")}><span className="cyan">G mask</span><b>e₁ can reach f₁, not f₂</b></button><button type="button" onClick={() => setSelected("A")}><span className="orange">weighted message</span><b>{up ? `f₁ ← 0.60·${sourceValues[0]} + 0.25·${sourceValues[1]} + 0.15·${sourceValues[2]}` : `e₂ ← 0.25·${sourceValues[0]} + 0.20·${sourceValues[1]}`}</b></button><button type="button" onClick={() => setSelected("K")}><span className="green">result</span><b>{up ? `k(f₁) = ${targetValues[0]}` : `k(e₂) = ${targetValues[1]}`}</b></button></div>
    </section>
    <div className="rank-flow">
      <div className={`rank-card ${up ? "current" : "target"}`}><span>rank s</span><b>{up ? "edges / interactions" : "faces / assemblies"}</b><small>H{up ? "ₛ" : "ₜ"} · source cochain</small></div>
      <div className="flow-column"><div className="cyan">G {up ? "routes upward" : "ᵀ routes downward"}</div><div className="orange">A chooses route weights</div><div className="flow-arrow">{up ? "→" : "←"}</div></div>
      <div className={`rank-card ${up ? "target" : "current"}`}><span>rank t</span><b>{up ? "faces / assemblies" : "edges / interactions"}</b><small>K{up ? "ₜ" : "ₛ"} · output cochain</small></div>
    </div>
    <div className="attention-legend"><button onClick={() => setSelected("G")} type="button"><i className="dot cyan"/> legal route</button><button onClick={() => setSelected("A")} type="button"><i className="dot orange"/> contextual weight</button><button onClick={() => setSelected("transport")} type="button"><i className="dot purple"/> optional local translation</button></div>
  </div>;
}

function HompView({ selected, setSelected }: { selected: TermKey; setSelected: (id: TermKey) => void }) {
  const [step, setStep] = useState(0);
  const [activeChannel, setActiveChannel] = useState(1);
  const [activeSender, setActiveSender] = useState(0);
  const [features, setFeatures] = useState([[1, -.1], [1, .3], [-.1, .9]]);
  const [senderWeights, setSenderWeights] = useState([[.7, .3], [.8, .2], [.25, .75]]);
  const [channelWeights, setChannelWeights] = useState([.25, .55, .2]);
  const stages: { n: string; label: string; terms: TermKey[] }[] = [{ n: "01", label: "construct", terms: ["messageFn", "message"] }, { n: "02", label: "gather inside 𝒩ₖ", terms: ["neighborAttention", "intra"] }, { n: "03", label: "merge channel types", terms: ["channelAttention", "inter"] }, { n: "04", label: "update receiver", terms: ["update"] }];
  const oldState = .5;
  const channelDefs = [
    { name: "incidence", short: "𝒩₁", color: "cyan", bias: 0, senders: ["e₁", "e₃"], evidence: ["shares vertex v₂", "shares vertex v₃"] },
    { name: "upper adjacency", short: "𝒩₂", color: "pink", bias: .2, senders: ["e₄", "e₅"], evidence: ["coface f₁₂₃", "coface f₂₃₄"] },
    { name: "temporal", short: "𝒩₃", color: "violet", bias: -.1, senders: ["x[t−1]", "x[t−2]"], evidence: ["one-step lag", "two-step lag"] },
  ];
  const channels = channelDefs.map((channel, c) => ({
    ...channel,
    messages: features[c].map(value => pretty(value - .2 * oldState + channel.bias)),
    weights: senderWeights[c],
    channelWeight: channelWeights[c],
  }));
  const channelSums = channels.map(channel => pretty(channel.messages.reduce((sum, message, i) => sum + message * channel.weights[i], 0)));
  const merged = pretty(channelSums.reduce((sum, message, i) => sum + message * channels[i].channelWeight, 0));
  const newState = pretty(Math.tanh(oldState + merged));
  const active = channels[activeChannel];
  const activeMessage = active.messages[activeSender];
  const activeWeightedMessage = pretty(activeMessage * active.weights[activeSender]);
  const choose = (index: number) => { setStep(index); setSelected(stages[index].terms[0]); };
  const chooseDatum = (channel: number, sender: number, term: TermKey = "neighborAttention") => { setActiveChannel(channel); setActiveSender(sender); setSelected(term); };
  const updateFeature = (value: number) => setFeatures(previous => previous.map((row, c) => c === activeChannel ? row.map((item, s) => s === activeSender ? value : item) : row));
  const updateSenderWeight = (value: number) => setSenderWeights(previous => previous.map((row, c) => c === activeChannel ? row.map((_, s) => s === activeSender ? value : pretty(1 - value)) : row));
  const updateChannelWeight = (value: number) => setChannelWeights(previous => {
    const otherTotal = previous.reduce((sum, item, index) => index === activeChannel ? sum : sum + item, 0);
    return previous.map((item, index) => index === activeChannel ? value : pretty((1 - value) * (otherTotal ? item / otherTotal : .5)));
  });
  const resetDataset = () => { setFeatures([[1, -.1], [1, .3], [-.1, .9]]); setSenderWeights([[.7, .3], [.8, .2], [.25, .75]]); setChannelWeights([.25, .55, .2]); setActiveChannel(1); setActiveSender(0); };
  return <div className="work-area homp-area">
    <div className="step-strip" role="tablist" aria-label="HOMP stages">{stages.map((item, index) => <button key={item.n} type="button" className={step === index ? "active" : ""} onClick={() => choose(index)}><span>{item.n}</span>{item.label}</button>)}</div>
    <div className="homp-equations">
      <div className={`homp-line ${step === 0 ? "active" : ""}`} onClick={() => choose(0)}><i>6.5</i><MathTerm id="message" selected={selected} onSelect={setSelected}>m<sub>x,y</sub></MathTerm><span>=</span><MathTerm id="messageFn" selected={selected} onSelect={setSelected}>α<sub>𝒩ₖ</sub>(h<sub>x</sub><sup>l</sup>, h<sub>y</sub><sup>l</sup>)</MathTerm><p>Build one typed message from y → x.</p></div>
      <div className={`homp-line ${step === 1 ? "active" : ""}`} onClick={() => choose(1)}><i>6.6</i><span>m<sub>x</sub><sup>k</sup> =</span><MathTerm id="intra" selected={selected} onSelect={setSelected}>⊕<sub>y∈𝒩ₖ(x)</sub></MathTerm><MathTerm id="neighborAttention" selected={selected} onSelect={setSelected}>a<sup>k</sup>(x,y)</MathTerm><MathTerm id="message" selected={selected} onSelect={setSelected}>m<sub>x,y</sub></MathTerm><p>Weight neighbors, then gather inside channel k.</p></div>
      <div className={`homp-line ${step === 2 ? "active" : ""}`} onClick={() => choose(2)}><i>6.7</i><span>m<sub>x</sub> =</span><MathTerm id="inter" selected={selected} onSelect={setSelected}>⊗<sub>𝒩ₖ∈𝒩</sub></MathTerm><MathTerm id="channelAttention" selected={selected} onSelect={setSelected}>b<sup>k</sup></MathTerm><span>m<sub>x</sub><sup>k</sup></span><p>Weight whole relation-types, then merge them.</p></div>
      <div className={`homp-line ${step === 3 ? "active" : ""}`} onClick={() => choose(3)}><i>6.8</i><span>h<sub>x</sub><sup>l+1</sup> =</span><MathTerm id="update" selected={selected} onSelect={setSelected}>β(h<sub>x</sub><sup>l</sup>, m<sub>x</sub>)</MathTerm><p>Write the merged information into x’s next state.</p></div>
    </div>
    <section className={`synthetic-panel homp-toy homp-step-${step}`} aria-label="Synthetic higher-order message passing graph">
      <div className="synthetic-head"><div><span className="toy-badge">synthetic data</span><h3>One receiver, three typed neighborhoods</h3></div><p>The stage buttons above highlight exactly what the layer is computing.</p></div>
      <div className="homp-graph-grid">
        <svg viewBox="0 0 690 360" role="img" aria-label="Six sender cells grouped into three typed neighborhoods sending messages to receiver x">
          <defs><marker id="homp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
          {channels.map((channel, c) => <g key={channel.name} className={`homp-channel channel-${channel.color}`}>
            <rect className="channel-zone" x="18" y={18 + c * 112} width="452" height="94" rx="15"/>
            <text className="channel-name" x="35" y={39 + c * 112}>{channel.short} · {channel.name} · b={channel.channelWeight}</text>
            {channel.messages.map((message, n) => {
              const x = 126 + n * 168; const y = 72 + c * 112;
              return <g key={n} className={`homp-sender ${c === activeChannel && n === activeSender ? "selected-datum" : ""}`} onClick={() => chooseDatum(c, n, step === 0 ? "message" : "neighborAttention")}><circle cx={x} cy={y} r="29"/><text x={x} y={y - 4}>{channel.senders[n]}</text><text className="toy-value" x={x} y={y + 14}>h={features[c][n]} · m={message}</text><line x1={x + 32} y1={y} x2="554" y2="180" style={{ strokeWidth: 2 + channel.weights[n] * 7 }} markerEnd="url(#homp-arrow)"/><text className="route-weight" x={(x + 554) / 2} y={(y + 180) / 2 - 6}>a={channel.weights[n]}</text></g>;
            })}
            <g className="channel-sum" onClick={() => setSelected("intra")}><rect x="378" y={47 + c * 112} width="76" height="43" rx="9"/><text x="416" y={65 + c * 112}>mˣ{c + 1}</text><text className="toy-value" x="416" y={81 + c * 112}>{channelSums[c]}</text></g>
          </g>)}
          <g className="homp-receiver" onClick={() => setSelected(step === 3 ? "update" : "inter")}><circle cx="606" cy="180" r="59"/><text x="606" y="165">receiver x</text><text className="toy-value" x="606" y="185">hˡ = {oldState}</text><text className="toy-result" x="606" y="207">hˡ⁺¹ = {newState}</text></g>
        </svg>
        <div className="homp-ledger">
          <button type="button" className={step === 0 ? "active" : ""} onClick={() => choose(0)}><span>construct</span><b>mₓ,{active.senders[activeSender]} = {activeMessage}</b><small>computed from the selected dataset row</small></button>
          <button type="button" className={step === 1 ? "active" : ""} onClick={() => choose(1)}><span>within channels</span><b>mₓ{activeChannel + 1} = {active.weights[0]}·{active.messages[0]} + {active.weights[1]}·{active.messages[1]} = {channelSums[activeChannel]}</b><small>attention, then sum inside {active.short}</small></button>
          <button type="button" className={step === 2 ? "active" : ""} onClick={() => choose(2)}><span>between channels</span><b>mₓ = Σ bᵏmₓᵏ = {merged}</b><small>𝒩₂ gets the largest channel gate</small></button>
          <button type="button" className={step === 3 ? "active" : ""} onClick={() => choose(3)}><span>update</span><b>tanh({oldState} + {merged}) = {newState}</b><small>write the merged message into x</small></button>
        </div>
      </div>
    </section>
    <section className="homp-dataset" aria-label="Editable synthetic HOMP dataset">
      <div className="dataset-heading"><div><p className="eyebrow">THE ACTUAL DATASET</p><h3>Six permitted sender → receiver records</h3><p>Receiver <b>x=e₂</b> has state <b>hₓ={oldState}</b>. Message rule: <b>mₓ,y = hᵧ − 0.2hₓ + relation bias</b>.</p></div><button type="button" onClick={resetDataset}>reset dataset</button></div>
      <div className="dataset-table-wrap"><table><thead><tr><th>channel k</th><th>sender y</th><th>why y∈𝒩ₖ(x)</th><th>hᵧ</th><th>mₓ,y</th><th>aᵏ(x,y)</th><th>aᵏm</th><th>bᵏ</th></tr></thead><tbody>{channels.flatMap((channel, c) => channel.messages.map((message, s) => <tr key={`${c}-${s}`} tabIndex={0} role="button" className={c === activeChannel && s === activeSender ? "active" : ""} onClick={() => chooseDatum(c, s)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseDatum(c, s); } }}><td><i className={`data-dot ${channel.color}`}/>{channel.short} {channel.name}</td><td>{channel.senders[s]}</td><td>{channel.evidence[s]}</td><td>{features[c][s]}</td><td>{message}</td><td>{channel.weights[s]}</td><td>{pretty(message * channel.weights[s])}</td><td>{channel.channelWeight}</td></tr>))}</tbody></table></div>
      <div className="dataset-workbench">
        <div className="dataset-selector"><span>selected record</span><b>{active.short} · {active.senders[activeSender]} → x</b><small>{active.evidence[activeSender]}</small><div className="sender-pick">{channels.map((channel, c) => <div key={channel.name}><strong>{channel.short}</strong>{channel.senders.map((sender, s) => <button type="button" key={sender} className={c === activeChannel && s === activeSender ? "active" : ""} onClick={() => chooseDatum(c, s)}>{sender}</button>)}</div>)}</div></div>
        <div className="data-sliders">
          <label><span>sender feature hᵧ <b>{features[activeChannel][activeSender]}</b></span><input aria-label="Selected sender feature" type="range" min="-1" max="1.5" step="0.05" value={features[activeChannel][activeSender]} onChange={event => updateFeature(Number(event.target.value))}/></label>
          <label><span>within-channel aᵏ <b>{active.weights[activeSender]}</b></span><input aria-label="Selected sender attention" type="range" min="0" max="1" step="0.05" value={active.weights[activeSender]} onChange={event => updateSenderWeight(Number(event.target.value))}/></label>
          <label><span>between-channel bᵏ <b>{active.channelWeight}</b></span><input aria-label="Selected channel attention" type="range" min="0" max="1" step="0.05" value={active.channelWeight} onChange={event => updateChannelWeight(Number(event.target.value))}/></label>
        </div>
        <div className="datum-calculation"><span>selected row</span><b>m = {features[activeChannel][activeSender]} − 0.2·{oldState} {active.bias >= 0 ? "+" : "−"} {Math.abs(active.bias)} = {activeMessage}</b><em>a·m = {active.weights[activeSender]}·{activeMessage} = {activeWeightedMessage}</em><hr/><span>channel → receiver</span><b>mₓ{activeChannel + 1} = {channelSums[activeChannel]}</b><em>b·mᵏ = {active.channelWeight}·{channelSums[activeChannel]} = {pretty(active.channelWeight * channelSums[activeChannel])}</em><strong>all channels: mₓ={merged} → hₓ′={newState}</strong></div>
      </div>
    </section>
  </div>;
}

function GccnView({ selected, setSelected }: { selected: TermKey; setSelected: (id: TermKey) => void }) {
  const [stage, setStage] = useState(0);
  const [activeView, setActiveView] = useState(1);
  const [processor, setProcessor] = useState<"GCN" | "GAT" | "GIN">("GAT");
  const [edgeMix, setEdgeMix] = useState(.55);
  const stages: { label: string; plain: string; term: TermKey }[] = [
    { label: "one complex", plain: "Start with one higher-order object.", term: "complex" },
    { label: "make views", plain: "Expose one typed relation at a time.", term: "viewGraph" },
    { label: "slice rows", plain: "Give each view its participating cells.", term: "subtensor" },
    { label: "process", plain: "Run one base graph model per view.", term: "omega" },
    { label: "synchronize", plain: "Merge proposals for the same cell.", term: "rankAggregate" },
    { label: "repeat", plain: "Use the merged state in the next layer.", term: "layer" },
    { label: "read out", plain: "Turn final cell states into a prediction.", term: "readout" },
  ];
  const views = [
    { key: "𝒩₁", name: "node ↔ node", rank: "rank 0 only", rows: "v₁, v₂, v₃, v₄", question: "Which vertices share an edge?", color: "cyan" },
    { key: "𝒩₂", name: "edge ↔ edge", rank: "rank 1 only", rows: "e₁₂, e₂₃, e₃₁, e₂₄, e₃₄", question: "Which edge-cells share an endpoint?", color: "pink" },
    { key: "𝒩₃", name: "face → edge", rank: "rank 2 into rank 1", rows: "f₁₂₃, f₂₃₄, e₁₂, e₂₃, e₃₁, e₂₄, e₃₄", question: "Which face contains which edge?", color: "violet" },
  ];
  const gain = { GCN: .34, GAT: .46, GIN: .57 }[processor];
  const oldEdge = .6;
  const adjacencyProposal = pretty(Math.tanh(oldEdge + gain * 1.15));
  const incidenceProposal = pretty(Math.tanh(oldEdge + gain * 1.7));
  const mergedEdge = pretty(edgeMix * adjacencyProposal + (1 - edgeMix) * incidenceProposal);
  const nextEdge = pretty(Math.tanh(mergedEdge + gain * .28));
  const chooseStage = (index: number) => { setStage(index); setSelected(stages[index].term); };
  return <div className={`work-area gccn-area gccn-stage-${stage}`}>
    <div className="gccn-step-strip" role="tablist" aria-label="GCCN pathway stages">{stages.map((item, index) => <button key={item.label} type="button" className={stage === index ? "active" : ""} onClick={() => chooseStage(index)}><span>0{index + 1}</span><b>{item.label}</b><small>{item.plain}</small></button>)}</div>

    <div className="gccn-equation" aria-label="Generalized combinatorial complex network layer">
      <span className="equation-kicker">THE WHOLE FIGURE IN ONE LINE · CLICK A TERM</span>
      <div>
        <MathTerm id="subtensor" selected={selected} onSelect={setSelected}>H<sup>l+1</sup></MathTerm><span>= φ( H<sup>l</sup>,</span>
        <MathTerm id="rankAggregate" selected={selected} onSelect={setSelected}>⊗<sub>𝒩∈𝒩𝒞</sub></MathTerm>
        <MathTerm id="omega" selected={selected} onSelect={setSelected}>ω<sub>𝒩</sub>(</MathTerm>
        <MathTerm id="subtensor" selected={selected} onSelect={setSelected}>H<sub>𝒩</sub><sup>l</sup></MathTerm><span>,</span>
        <MathTerm id="viewGraph" selected={selected} onSelect={setSelected}>𝒢<sub>𝒩</sub></MathTerm><span>))</span>
      </div>
      <p><b>Read it:</b> “For each relation-view, process the participating cell rows; align outputs that name the same cell; merge them into one next-layer state.”</p>
    </div>

    <section className="gccn-origin" aria-label="Synthetic combinatorial complex dataset">
      <div className="gccn-origin-copy"><span className="toy-badge">synthetic dataset</span><h3>One complex 𝒞—not three datasets</h3><p>Four vertices, five edges, and two filled faces. The center edge <b>e₂₃</b> is our tracer: it will reappear in two computational views while remaining one underlying cell.</p><button type="button" onClick={() => { setSelected("complex"); setStage(0); }}>select original complex</button></div>
      <svg viewBox="0 0 390 235" role="img" aria-label="Two filled triangles sharing edge e23">
        <polygon className="gccn-face face-a" points="45,190 177,32 191,190"/><polygon className="gccn-face face-b" points="191,190 177,32 345,158"/>
        <g className="gccn-original-edges"><line x1="45" y1="190" x2="177" y2="32"/><line className="tracer" x1="177" y1="32" x2="191" y2="190"/><line x1="191" y1="190" x2="45" y2="190"/><line x1="177" y1="32" x2="345" y2="158"/><line x1="345" y1="158" x2="191" y2="190"/></g>
        <g className="gccn-original-nodes"><circle cx="45" cy="190" r="11"/><circle cx="177" cy="32" r="11"/><circle cx="191" cy="190" r="11"/><circle cx="345" cy="158" r="11"/></g>
        <g className="gccn-labels"><text x="34" y="218">v₁</text><text x="177" y="17">v₂</text><text x="191" y="218">v₃</text><text x="360" y="161">v₄</text><text x="108" y="102">e₁₂</text><text className="tracer-label" x="205" y="106">e₂₃ · hˡ=.60</text><text x="118" y="183">e₃₁</text><text x="266" y="83">e₂₄</text><text x="277" y="185">e₃₄</text><text x="112" y="145">f₁₂₃</text><text x="264" y="137">f₂₃₄</text></g>
      </svg>
    </section>

    <section className="gccn-views" aria-label="Three graph views derived from the synthetic complex">
      <div className="gccn-section-heading"><div><p className="eyebrow">EXPAND 𝒞 INTO TYPED GRAPH VIEWS</p><h3>The graph-nodes change meaning in each view</h3></div><p>Click a view. A circle in 𝒢<sub>𝒩₂</sub> can represent an <em>edge-cell</em>, not an original vertex.</p></div>
      <div className="gccn-view-grid">{views.map((view, index) => <button type="button" key={view.key} className={`gccn-view-card view-${view.color} ${activeView === index ? "active" : ""}`} onClick={() => { setActiveView(index); setSelected("viewGraph"); setStage(1); }}>
        <span><i>{view.key}</i>{view.name}</span><b>𝒢<sub>{view.key}</sub> · {view.rank}</b>
        {index === 0 && <svg viewBox="0 0 230 125" aria-label="Vertex adjacency graph"><g className="mini-links"><line x1="28" y1="92" x2="99" y2="27"/><line x1="99" y1="27" x2="108" y2="94"/><line x1="108" y1="94" x2="28" y2="92"/><line x1="99" y1="27" x2="202" y2="73"/><line x1="202" y1="73" x2="108" y2="94"/></g><g className="mini-v-nodes"><circle cx="28" cy="92" r="13"/><circle cx="99" cy="27" r="13"/><circle cx="108" cy="94" r="13"/><circle cx="202" cy="73" r="13"/></g><g className="mini-text"><text x="28" y="96">v₁</text><text x="99" y="31">v₂</text><text x="108" y="98">v₃</text><text x="202" y="77">v₄</text></g></svg>}
        {index === 1 && <svg viewBox="0 0 230 125" aria-label="Edge cells connected when sharing vertices"><g className="mini-links"><line x1="38" y1="35" x2="115" y2="61"/><line x1="38" y1="35" x2="70" y2="105"/><line x1="115" y1="61" x2="70" y2="105"/><line x1="115" y1="61" x2="187" y2="30"/><line x1="115" y1="61" x2="190" y2="101"/><line x1="187" y1="30" x2="190" y2="101"/></g><g className="mini-e-nodes"><circle cx="38" cy="35" r="18"/><circle className="tracer-node" cx="115" cy="61" r="21"/><circle cx="70" cy="105" r="18"/><circle cx="187" cy="30" r="18"/><circle cx="190" cy="101" r="18"/></g><g className="mini-text"><text x="38" y="39">e₁₂</text><text x="115" y="65">e₂₃</text><text x="70" y="109">e₃₁</text><text x="187" y="34">e₂₄</text><text x="190" y="105">e₃₄</text></g></svg>}
        {index === 2 && <svg viewBox="0 0 230 125" aria-label="Bipartite face to edge incidence graph"><g className="mini-links"><line x1="58" y1="27" x2="25" y2="98"/><line x1="58" y1="27" x2="78" y2="98"/><line x1="58" y1="27" x2="130" y2="98"/><line x1="173" y1="27" x2="78" y2="98"/><line x1="173" y1="27" x2="168" y2="98"/><line x1="173" y1="27" x2="210" y2="98"/></g><g className="mini-f-nodes"><path d="M42 38 L58 11 L74 38 Z"/><path d="M157 38 L173 11 L189 38 Z"/></g><g className="mini-e-nodes"><circle cx="25" cy="98" r="15"/><circle className="tracer-node" cx="78" cy="98" r="18"/><circle cx="130" cy="98" r="15"/><circle cx="168" cy="98" r="15"/><circle cx="210" cy="98" r="15"/></g><g className="mini-text"><text x="58" y="29">f₁</text><text x="173" y="29">f₂</text><text x="25" y="102">e₁₂</text><text x="78" y="102">e₂₃</text><text x="130" y="102">e₃₁</text><text x="168" y="102">e₂₄</text><text x="210" y="102">e₃₄</text></g></svg>}
        <small>{view.question}</small><em>H<sub>{view.key}</sub><sup>l</sup> rows: {view.rows}</em>
      </button>)}</div>
    </section>

    <section className="gccn-compute" aria-label="Concrete processing and rank-level synchronization for edge e23">
      <div className="gccn-section-heading"><div><p className="eyebrow">FOLLOW e₂₃ THROUGH ONE LAYER</p><h3>Two views make two proposals for the same edge-cell</h3></div><div className="processor-picker" aria-label="Base graph processor">{(["GCN", "GAT", "GIN"] as const).map(model => <button type="button" key={model} className={processor === model ? "active" : ""} onClick={() => { setProcessor(model); setSelected("omega"); setStage(3); }}>{model}</button>)}</div></div>
      <div className="gccn-pathway">
        <button type="button" className="path-block path-slice" onClick={() => { setSelected("subtensor"); setStage(2); }}><span>copy current row</span><b>h<sub>e₂₃</sub><sup>l</sup> = {oldEdge}</b><small>same underlying row enters both views</small></button>
        <div className="path-split">↗<br/>↘</div>
        <div className="proposal-stack">
          <button type="button" onClick={() => { setSelected("omega"); setStage(3); }}><span>𝒢<sub>𝒩₂</sub> · edge adjacency</span><b>ω<sub>𝒩₂</sub><sup>{processor}</sup> → z<sub>e₂₃</sub>={adjacencyProposal}</b><small>e₂₃ listens to neighboring edge-cells</small></button>
          <button type="button" onClick={() => { setSelected("omega"); setStage(3); }}><span>𝒢<sub>𝒩₃</sub> · face incidence</span><b>ω<sub>𝒩₃</sub><sup>{processor}</sup> → z<sub>e₂₃</sub>={incidenceProposal}</b><small>e₂₃ listens to incident face-cells</small></button>
        </div>
        <div className="path-join">↘<br/>↗</div>
        <button type="button" className="path-block path-merge" onClick={() => { setSelected("rankAggregate"); setStage(4); }}><span>align on cell ID e₂₃</span><b>{edgeMix.toFixed(2)}·{adjacencyProposal} + {(1-edgeMix).toFixed(2)}·{incidenceProposal}</b><strong>h<sub>e₂₃</sub><sup>l+1</sup> = {mergedEdge}</strong><small>no other edge is pooled into this writeback</small></button>
        <div className="path-forward">→</div>
        <button type="button" className="path-block path-next" onClick={() => { setSelected("layer"); setStage(5); }}><span>next GCCN layer</span><b>e₂₃ starts at {mergedEdge}</b><strong>next proposal ≈ {nextEdge}</strong><small>rank 1; depth l+1</small></button>
      </div>
      <label className="gccn-mix-slider"><span><b>⊗ merge for e₂₃</b> favor edge-adjacency <i>{Math.round(edgeMix*100)}%</i> vs face-incidence <i>{Math.round((1-edgeMix)*100)}%</i></span><input aria-label="Balance edge adjacency and face incidence proposals" type="range" min="0" max="1" step="0.05" value={edgeMix} onChange={event => { setEdgeMix(Number(event.target.value)); setSelected("rankAggregate"); setStage(4); }}/></label>
    </section>

    <section className="gccn-decoder">
      <div><p className="eyebrow">NOTATION DECODER</p><h3>Four labels that live on different axes</h3></div>
      <div className="gccn-decoder-grid"><button type="button" onClick={() => setSelected("layer")}><b>superscript l</b><span>network depth</span><small>how many learned passes</small></button><button type="button" onClick={() => setSelected("viewGraph")}><b>subscript 𝒩ᵢ</b><span>relation / graph view</span><small>which cells may talk</small></button><button type="button" onClick={() => setSelected("rank")}><b>rank 0 / 1 / 2</b><span>cell type</span><small>vertex, edge, or face</small></button><button type="button" onClick={() => setSelected("omega")}><b>ω<sub>𝒩</sub></b><span>whole base model</span><small>not just a weight matrix</small></button><button type="button" onClick={() => setSelected("rankAggregate")}><b>⊗<sub>rank</sub></b><span>same-cell merge</span><small>not all-edge pooling</small></button><button type="button" onClick={() => { setSelected("readout"); setStage(6); }}><b>Readout R</b><span>task head</span><small>after the final layer</small></button></div>
      <div className="gccn-warning"><b>The original pathway’s easiest trap:</b><span>e₂₃ appears twice because two graph views can update it—not because the dataset contains two different e₂₃ cells. Synchronization reunites those computational copies by cell identity.</span></div>
    </section>
  </div>;
}

type MotifId = "raise" | "lower" | "liftReturn" | "lowerAdj" | "upperAdj" | "hodge" | "selfLoop" | "attention" | "multihead" | "parallel" | "multiHop" | "coherent" | "incoherent" | "feedback" | "bifan";

function MotifDiagram({ id, biological = false }: { id: MotifId; biological?: boolean }) {
  const suffix = biological ? "bio" : "tdl";
  const label = biological ? { low: "gene / protein", mid: "regulator", high: "target" } : { low: "rank r−1", mid: "rank r", high: "rank r+1" };
  const commonNodes = <g className="motif-svg-nodes"><circle className="rank0" cx="80" cy="205" r="23"/><circle className="rank1" cx="210" cy="112" r="23"/><circle className="rank2" cx="340" cy="45" r="23"/></g>;
  const line = (x1: number, y1: number, x2: number, y2: number, cls = "standard") => <line className={cls} x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={`url(#arrow-${suffix})`}/>;
  let content: React.ReactNode;
  if (id === "raise" || id === "lower") content = <>{commonNodes}<g className="motif-svg-routes">{id === "raise" ? <>{line(95,188,194,129)}{line(226,96,325,57)}</> : <>{line(325,57,226,96)}{line(194,129,95,188)}</>}</g><g className="motif-svg-labels"><text x="80" y="210">{biological ? "gene X" : "v / node"}</text><text x="210" y="117">{biological ? "complex Y" : "e / edge"}</text><text x="340" y="50">{biological ? "module Z" : "f / face"}</text><text x="142" y="150">{id === "raise" ? "Bᵣᵀ" : "Bᵣ"}</text><text x="274" y="77">{id === "raise" ? "Bᵣ₊₁ᵀ" : "Bᵣ₊₁"}</text></g></>;
  else if (id === "liftReturn") content = <><g className="motif-svg-nodes"><circle className="rank0" cx="65" cy="190" r="23"/><circle className="rank1" cx="210" cy="65" r="28"/><circle className="rank0" cx="355" cy="190" r="23"/></g><g className="motif-svg-routes">{line(83,174,190,83)}{line(230,83,337,174)}</g><g className="motif-svg-labels"><text x="65" y="195">{biological ? "gene X" : "v₁"}</text><text x="210" y="70">{biological ? "regulon" : "hyperedge e"}</text><text x="355" y="195">{biological ? "gene Z" : "v₂"}</text><text x="130" y="120">B₁ᵀ</text><text x="290" y="120">B₁</text><text x="210" y="225">lift into a group, then broadcast back</text></g></>;
  else if (id === "lowerAdj" || id === "upperAdj") content = <><g className="motif-svg-nodes"><circle className="rank1" cx="80" cy="72" r="25"/><circle className={id === "lowerAdj" ? "rank0" : "rank2"} cx="210" cy="185" r="28"/><circle className="rank1" cx="340" cy="72" r="25"/></g><g className="motif-svg-routes">{line(192,168,99,89)}{line(229,166,321,89)}</g><g className="motif-svg-labels"><text x="80" y="77">{biological ? "reaction 1" : "e₁₂"}</text><text x="340" y="77">{biological ? "reaction 2" : "e₂₃"}</text><text x="210" y="190">{id === "lowerAdj" ? (biological ? "shared TF" : "shared v₂") : (biological ? "same module" : "coface f₁₂₃")}</text><text x="210" y="28">{id === "lowerAdj" ? "L↓,r = BᵣᵀBᵣ" : "L↑,r = Bᵣ₊₁Bᵣ₊₁ᵀ"}</text></g></>;
  else if (id === "hodge") content = <><g className="motif-svg-nodes"><circle className="rank0" cx="65" cy="198" r="22"/><circle className="rank1" cx="210" cy="125" r="29"/><circle className="rank2" cx="355" cy="198" r="22"/><circle className="rank1" cx="210" cy="42" r="22"/></g><g className="motif-svg-routes">{line(85,188,181,140,"lower-route")}{line(335,188,239,140,"upper-route")}{line(210,65,210,93,"merge-route")}</g><g className="motif-svg-labels"><text x="65" y="203">{biological ? "direct cue" : "lower face"}</text><text x="355" y="203">{biological ? "module cue" : "upper coface"}</text><text x="210" y="130">{biological ? "target Z" : "cell xᵣ"}</text><text x="210" y="47">Σ</text><text x="210" y="235">two same-rank evidence channels</text></g></>;
  else if (id === "selfLoop") content = <><g className="motif-svg-nodes"><circle className="rank1" cx="210" cy="125" r="34"/></g><path className="loop-route" d="M190 94 C135 25 285 25 230 94" markerEnd={`url(#arrow-${suffix})`}/><g className="motif-svg-labels"><text x="210" y="130">{biological ? "gene X" : "hₓˡ"}</text><text x="210" y="28">{biological ? "auto-regulation" : "initial-state / residual loop"}</text><text x="210" y="205">sign + gain + delay determine the dynamics</text></g></>;
  else if (id === "attention" || id === "multihead") content = <><g className="motif-svg-nodes"><circle className="rank0" cx="80" cy="125" r="27"/><circle className="rank1" cx="340" cy="125" r="27"/></g><g className="motif-svg-routes">{line(108,125,310,125,"attention-route")}{id === "multihead" && <><path className="head-route head-a" d="M108 110 Q210 28 312 110" markerEnd={`url(#arrow-${suffix})`}/><path className="head-route head-b" d="M108 140 Q210 222 312 140" markerEnd={`url(#arrow-${suffix})`}/></>}</g><g className="motif-svg-labels"><text x="80" y="130">{biological ? "TF X" : "sender y"}</text><text x="340" y="130">{biological ? "gene Z" : "receiver x"}</text><text x="210" y="110">α(x,y)={id === "multihead" ? "{.2,.6,.9}" : ".72"}</text><text x="210" y="28">{biological ? "context-sensitive interaction strength" : id === "multihead" ? "several learned views of one route" : "red = attentional message"}</text><text x="210" y="220">wiring stays legal; gain changes with state</text></g></>;
  else if (id === "parallel") content = <><g className="motif-svg-nodes"><circle className="rank0" cx="65" cy="60" r="21"/><circle className="rank1" cx="65" cy="125" r="21"/><circle className="rank2" cx="65" cy="190" r="21"/><circle className="rank1" cx="345" cy="125" r="30"/></g><g className="motif-svg-routes">{line(87,66,317,113,"lower-route")}{line(87,125,313,125,"standard")}{line(87,184,317,137,"upper-route")}</g><g className="motif-svg-labels"><text x="65" y="65">{biological ? "TF X" : "𝒩₁"}</text><text x="65" y="130">{biological ? "TF Y" : "𝒩₂"}</text><text x="65" y="195">{biological ? "cue S" : "𝒩₃"}</text><text x="345" y="130">{biological ? "gene Z" : "⊗"}</text><text x="210" y="32">process separately → merge</text><text x="210" y="225">{biological ? "multi-input integration" : "P paths / inter-neighborhood aggregation"}</text></g></>;
  else if (id === "multiHop") content = <><g className="motif-svg-nodes"><circle className="rank0" cx="45" cy="125" r="21"/><circle className="rank1" cx="145" cy="125" r="21"/><circle className="rank1" cx="255" cy="125" r="21"/><circle className="rank2" cx="365" cy="125" r="21"/></g><g className="motif-svg-routes">{line(68,125,120,125)}{line(168,125,230,125)}{line(278,125,340,125)}</g><g className="motif-svg-labels"><text x="45" y="130">{biological ? "X" : "x"}</text><text x="145" y="130">{biological ? "Y" : "1 hop"}</text><text x="255" y="130">{biological ? "Q" : "2 hops"}</text><text x="365" y="130">{biological ? "Z" : "3 hops"}</text><text x="210" y="55">{biological ? "regulatory cascade" : "Gᵖ / polynomial filter"}</text><text x="210" y="205">farther reach, more mixing and delay</text></g></>;
  else if (id === "coherent" || id === "incoherent") content = <><g className="motif-svg-nodes"><circle className="rank0" cx="70" cy="55" r="27"/><circle className="rank1" cx="210" cy="180" r="27"/><circle className="rank2" cx="350" cy="55" r="27"/></g><g className="motif-svg-routes">{line(96,55,320,55,"positive-route")}{line(86,78,190,158,"positive-route")}{line(231,162,334,78,id === "coherent" ? "positive-route" : "negative-route")}</g><g className="motif-svg-labels"><text x="70" y="60">X</text><text x="210" y="185">Y</text><text x="350" y="60">Z</text><text className="sign" x="210" y="45">+</text><text className="sign" x="142" y="126">+</text><text className={id === "coherent" ? "sign" : "minus-sign"} x="280" y="126">{id === "coherent" ? "+" : "−"}</text><text x="210" y="225">{id === "coherent" ? "paths agree → persistence filter / delay" : "paths oppose → pulse / acceleration / adaptation"}</text></g></>;
  else if (id === "feedback") content = <><g className="motif-svg-nodes"><circle className="rank0" cx="100" cy="125" r="31"/><circle className="rank1" cx="320" cy="125" r="31"/></g><g className="motif-svg-routes">{line(132,112,288,112,"positive-route")}{line(288,140,132,140,"negative-route")}</g><g className="motif-svg-labels"><text x="100" y="130">{biological ? "sensor X" : "state x"}</text><text x="320" y="130">{biological ? "regulator Y" : "state y"}</text><text className="sign" x="210" y="97">+</text><text className="minus-sign" x="210" y="163">−</text><text x="210" y="38">closed causal cycle</text><text x="210" y="215">negative: restore · positive: reinforce</text></g></>;
  else content = <><g className="motif-svg-nodes"><circle className="rank0" cx="105" cy="55" r="24"/><circle className="rank0" cx="315" cy="55" r="24"/><circle className="rank1" cx="105" cy="190" r="24"/><circle className="rank1" cx="315" cy="190" r="24"/></g><g className="motif-svg-routes">{line(105,80,105,163)}{line(122,73,297,172)}{line(298,73,122,172)}{line(315,80,315,163)}</g><g className="motif-svg-labels"><text x="105" y="60">{biological ? "TF X" : "sender 1"}</text><text x="315" y="60">{biological ? "TF Y" : "sender 2"}</text><text x="105" y="195">{biological ? "gene Z" : "target 1"}</text><text x="315" y="195">{biological ? "gene W" : "target 2"}</text><text x="210" y="128">bi-fan</text><text x="210" y="230">shared inputs coordinate a target module</text></g></>;
  return <svg viewBox="0 0 420 250" role="img" aria-label={`${biological ? "Systems biology" : "Topological message passing"} diagram for ${id}`}><defs><marker id={`arrow-${suffix}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>{content}<text className="motif-axis-note" x="12" y="238">{biological ? "signed regulatory graph" : `${label.low} ↔ ${label.mid} ↔ ${label.high}`}</text></svg>;
}

function MotifAtlas({ selected, setSelected }: { selected: TermKey; setSelected: (id: TermKey) => void }) {
  const [activeId, setActiveId] = useState<MotifId>("liftReturn");
  const [family, setFamily] = useState<"all" | "routing" | "overlay" | "alon">("all");
  const [input, setInput] = useState(.8);
  const [context, setContext] = useState(.55);
  const motifs: { id: MotifId; family: "routing" | "overlay" | "alon"; title: string; glyph: string; operator: string; plain: string; alon: string; relation: string; term: TermKey }[] = [
    { id:"raise", family:"routing", title:"incidence raise", glyph:"Bᵣᵀ ↑", operator:"r−1 → r", plain:"Members propose a state for the larger object containing them.", alon:"A gene or protein contributes to a complex, regulon, reaction, or higher-order module.", relation:"functional analogy", term:"motifRoute" },
    { id:"lower", family:"routing", title:"incidence lower", glyph:"Bᵣ ↓", operator:"r → r−1", plain:"A higher-order object broadcasts context back to its boundary members.", alon:"A pathway, complex, or cellular context modulates participating genes or proteins.", relation:"functional analogy", term:"motifRoute" },
    { id:"liftReturn", family:"routing", title:"two-phase lift → return", glyph:"B₁B₁ᵀ", operator:"node → hyperedge → node", plain:"Nodes meet by first pooling into a shared hyperedge, then sending the pooled state back.", alon:"A shared regulon or protein complex mediates coordination among its members.", relation:"functional analogy", term:"motifRoute" },
    { id:"lowerAdj", family:"routing", title:"lower adjacency", glyph:"BᵣᵀBᵣ", operator:"r → r−1 → r", plain:"Same-rank cells communicate because they share a lower-dimensional face.", alon:"Two reactions or interactions are coupled because they share a gene, protein, or metabolite.", relation:"functional analogy", term:"lowerLap" },
    { id:"upperAdj", family:"routing", title:"upper adjacency", glyph:"Bᵣ₊₁Bᵣ₊₁ᵀ", operator:"r → r+1 → r", plain:"Same-rank cells communicate because they jointly bound a higher-order coface.", alon:"Two interactions are coupled because they belong to the same complex or regulatory module.", relation:"functional analogy", term:"upperLap" },
    { id:"hodge", family:"routing", title:"dual neighborhood sum", glyph:"L↓ + L↑", operator:"lower evidence + upper evidence", plain:"Keep two ways of being related distinct, then add or learn how to merge them.", alon:"Looks like direct and indirect evidence converging on one target, but is not automatically an FFL.", relation:"functional analogy only", term:"hodge" },
    { id:"selfLoop", family:"overlay", title:"self / residual loop", glyph:"↺ hₓ", operator:"old state → new state", plain:"The receiver keeps some of its previous feature during its update.", alon:"Autoregulation is the same one-node shape; positive and negative signs yield opposite dynamics.", relation:"exact shape; semantics differ", term:"motifLoop" },
    { id:"attention", family:"overlay", title:"attentional edge", glyph:"α(x,y)", operator:"contextual route weight", plain:"The route exists structurally, but its gain depends on the current cell states.", alon:"Closest to context-dependent binding or regulation strength—not an Alon motif by itself.", relation:"no direct motif analog", term:"motifAttention" },
    { id:"multihead", family:"overlay", title:"multi-head attention", glyph:"⌒⌒⌒", operator:"several views of one route", plain:"Several learned scoring rules inspect the same relation in parallel.", alon:"Could model multiple biochemical contexts or binding modes, but the arcs are model channels, not extra genes.", relation:"no direct motif analog", term:"motifAttention" },
    { id:"parallel", family:"overlay", title:"parallel channels → merge", glyph:"P → ⊗", operator:"separate, then aggregate", plain:"Different neighborhoods send separate proposals before a sum, mean, or concatenation.", alon:"Resembles multi-input integration at a promoter or shared targets in a bi-fan.", relation:"functional analogy", term:"motifParallel" },
    { id:"multiHop", family:"overlay", title:"multi-hop / polynomial", glyph:"Gᵖ", operator:"repeat a route p times", plain:"One layer reaches beyond immediate neighbors by applying a neighborhood operator repeatedly.", alon:"A regulatory cascade; extra hops add reach but also delay and opportunities for distortion.", relation:"exact path shape", term:"motifRoute" },
    { id:"coherent", family:"alon", title:"coherent feed-forward loop", glyph:"C1-FFL", operator:"X→Z and X→Y→Z agree", plain:"The direct and indirect paths push the target in the same direction.", alon:"With AND-like integration it can reject short inputs and delay ON while allowing rapid OFF.", relation:"canonical Alon motif", term:"motifFFL" },
    { id:"incoherent", family:"alon", title:"incoherent feed-forward loop", glyph:"I1-FFL", operator:"X→Z; X→Y⊣Z", plain:"The direct path activates while the delayed indirect path opposes it.", alon:"Can accelerate responses, generate a pulse, adapt, or detect fold changes under suitable kinetics.", relation:"canonical Alon motif", term:"motifFFL" },
    { id:"feedback", family:"alon", title:"feedback loop", glyph:"X ⇄ Y", operator:"closed causal cycle", plain:"A downstream response returns to influence an upstream variable.", alon:"Negative feedback supports homeostasis; positive feedback can yield memory or bistability; delay may oscillate.", relation:"canonical circuit motif", term:"motifLoop" },
    { id:"bifan", family:"alon", title:"bi-fan / multi-input module", glyph:"2 × 2", operator:"two regulators → two targets", plain:"Two senders jointly control the same pair of receivers.", alon:"Coordinates a target module and is an enriched motif in several biological network classes.", relation:"canonical Alon motif", term:"motifParallel" },
  ];
  const active = motifs.find(motif => motif.id === activeId)!;
  const filtered = motifs.filter(motif => family === "all" || motif.family === family);
  const delayed = pretty(input * context);
  const direct = pretty(.8 * input);
  const indirect = pretty(.65 * delayed);
  const signedIndirect = activeId === "incoherent" ? -indirect : indirect;
  const output = pretty(Math.tanh(activeId === "coherent" || activeId === "incoherent" ? direct + signedIndirect : activeId === "selfLoop" || activeId === "feedback" ? input + context * .55 : input * (.45 + context)));
  const choose = (motif: typeof motifs[number]) => { setActiveId(motif.id); setSelected(motif.term); };
  return <div className={`work-area motif-area selected-${selected}`}>
    <section className="motif-thesis"><div><span className="eyebrow">FIRST: TWO MEANINGS OF “MOTIF”</span><h3>Same small shape; different scientific claim</h3></div><div className="motif-thesis-grid"><button type="button" onClick={() => setSelected("motifRoute")}><b>Papillon tensor-diagram motif</b><span>A reusable computation pattern: ranks, legal routes, learned weights, aggregation, update.</span></button><div className="motif-versus">≠</div><button type="button" onClick={() => setSelected("motifNull")}><b>Uri Alon network motif</b><span>A signed biological subgraph that occurs more often than expected under a specified randomized null model.</span></button></div></section>
    <section className="glyph-key"><div><p className="eyebrow">READ THE ORIGINAL PLATE</p><h3>Its visual grammar has only a handful of primitives</h3></div><div className="glyph-grid"><button type="button" onClick={() => setSelected("rank")}><i className="glyph-dots"><em/><em/><em/><em/></i><b>circle color</b><small>cell rank: 0, 1, 2, or r</small></button><button type="button" onClick={() => setSelected("motifRoute")}><i className="glyph-arrow black"/><b>black arrow</b><small>standard learned message</small></button><button type="button" onClick={() => setSelected("motifAttention")}><i className="glyph-arrow red"/><b>red arrow / arc</b><small>attention / attention head</small></button><button type="button" onClick={() => setSelected("motifLoop")}><i className="glyph-loop">↺</i><b>loop over cell</b><small>reuse old feature or learned self-update</small></button><button type="button" onClick={() => setSelected("motifParallel")}><i className="glyph-merge">⌣</i><b>colored / black cup</b><small>aggregate within / between neighborhoods</small></button><button type="button" onClick={() => setSelected("motifRoute")}><i className="glyph-power">[○]<sup>p</sup></i><b>power p</b><small>repeat route for p-hop reach</small></button></div></section>
    <section className="motif-browser">
      <div className="motif-browser-head"><div><p className="eyebrow">CLICK A MOTIF</p><h3>Fifteen primitives instead of fifty tiny architectures</h3></div><div className="motif-filters" role="tablist" aria-label="Motif family">{(["all","routing","overlay","alon"] as const).map(item => <button type="button" className={family === item ? "active" : ""} key={item} onClick={() => setFamily(item)}>{item === "overlay" ? "learning overlays" : item === "alon" ? "Alon circuits" : item}</button>)}</div></div>
      <div className="motif-card-grid">{filtered.map(motif => <button type="button" key={motif.id} className={`motif-card ${activeId === motif.id ? "active" : ""}`} onClick={() => choose(motif)}><span>{motif.family}</span><b>{motif.glyph}</b><strong>{motif.title}</strong><small>{motif.operator}</small></button>)}</div>
    </section>
    <section className="motif-focus" aria-label={`Detailed comparison for ${active.title}`}>
      <div className="motif-focus-head"><div><span className="toy-badge">synthetic circuit</span><h3>{active.title}</h3><p>{active.plain}</p></div><b className={`analogy-badge relation-${active.relation.includes("no direct") ? "none" : active.relation.includes("canonical") || active.relation.includes("exact") ? "exact" : "analogy"}`}>{active.relation}</b></div>
      <div className="motif-compare">
        <div className="motif-side"><div><span>TDL / operator reading</span><b>{active.operator}</b></div><MotifDiagram id={active.id}/><p><strong>Question answered:</strong> Which typed cells may exchange features, through which operator, and how are their proposals combined?</p></div>
        <div className="motif-side biological"><div><span>Uri Alon / systems-biology reading</span><b>{active.alon}</b></div><MotifDiagram id={active.id} biological/><p><strong>Question answered:</strong> What signed causal circuit recurs, what dynamics can it implement, and is it enriched against a defensible null?</p></div>
      </div>
      <div className="motif-simulator"><div><span className="eyebrow">TINY DYNAMICAL CHECK</span><h4>{activeId === "coherent" || activeId === "incoherent" ? "Direct path arrives now; indirect path arrives later" : "Change signal and context; the same wiring produces a different update"}</h4></div><label><span>input X <b>{input.toFixed(2)}</b></span><input aria-label="Motif input activity" type="range" min="0" max="1" step="0.05" value={input} onChange={event => setInput(Number(event.target.value))}/></label><label><span>{activeId === "coherent" || activeId === "incoherent" ? "indirect path developed" : "context / feedback gain"} <b>{context.toFixed(2)}</b></span><input aria-label="Motif context or delay" type="range" min="0" max="1" step="0.05" value={context} onChange={event => setContext(Number(event.target.value))}/></label><div className="motif-output"><span>synthetic output</span><b>Z = {output}</b><small>{activeId === "incoherent" ? `${direct} direct − ${indirect} delayed inhibition` : activeId === "coherent" ? `${direct} direct + ${indirect} delayed activation` : `tanh[input × route/context rule]`}</small></div></div>
      <div className="motif-ledger"><div><span>dataset entity</span><b>X · input TF</b><small>activity = {input.toFixed(2)}</small></div><div><span>intermediate</span><b>Y · regulator / r-cell</b><small>activity = {delayed}</small></div><div><span>direct contribution</span><b>X → Z</b><small>+0.80 × X = {direct}</small></div><div><span>indirect contribution</span><b>X → Y → Z</b><small>{activeId === "incoherent" ? "−" : "+"}0.65 × Y = {signedIndirect}</small></div><div><span>receiver</span><b>Z · target</b><small>updated activity = {output}</small></div></div>
    </section>
    <section className="motif-caution"><div><b>Architecture motif</b><span>Chosen by the model designer</span><small>Can include tensors, ranks, nonlinearities, attention heads, and aggregation operators.</small></div><div><b>Biological network motif</b><span>Inferred from a measured signed network</span><small>Must be counted and compared against randomized networks with the right invariants preserved.</small></div><div><b>Higher-order motif</b><span>May require hyperedges or cells</span><small>Pairwise projection can turn one biochemical complex into many apparent arrows and change motif counts.</small></div></section>
  </div>;
}

function DomainExplorer({ setSelected }: { setSelected: (id: TermKey) => void }) {
  const [domain, setDomain] = useState<"graph" | "simplicial" | "hypergraph" | "cc">("graph");
  const copy = {
    graph: { title: "Ordinary graph", formula: "L₀ = B₁ B₁ᵀ", text: "B₁ records vertex–edge incidence. On vertices, down is impossible; the graph Laplacian is the one available up→down round trip. On edge signals, B₁ᵀB₁ compares edges through shared vertices.", caveat: "No 2-cells means no upper edge neighborhood." },
    simplicial: { title: "Simplicial complex", formula: "L₁ = B₁ᵀB₁ + B₂B₂ᵀ", text: "Edges have two distinct neighborhoods: shared endpoints below and shared filled triangles above. Orientation gives signed incidence and B₁B₂=0, so this is genuine chain-complex/Hodge algebra.", caveat: "Removing a filled face can create a harmonic 1-cycle." },
    hypergraph: { title: "Hypergraph", formula: "IᵀI  or  IIᵀ", text: "The incidence matrix I moves between vertices and set-valued hyperedges. The two Gram products compare hyperedges by member overlap or vertices by co-membership.", caveat: "A plain hypergraph has no canonical oriented boundary-of-boundary law, so these are not automatically Hodge raising/lowering operators." },
    cc: { title: "Combinatorial complex", formula: "Kᵣ = Σₛ Gᵣ←ₛ Hₛ Wᵣ←ₛ", text: "Ranked cells can communicate through several incidence or adjacency maps, even when ranks are not simplex dimensions. A merge node adds the typed push-forwards into one target rank.", caveat: "Papillon’s framework is broader than a chain complex; a Hodge interpretation applies only to operators with the required algebraic structure." },
  }[domain];
  return <section className="domain-explorer">
    <div className="domain-heading"><div><p className="eyebrow">WHERE THE OPERATORS ACT</p><h3>Change the domain; watch the algebra change</h3></div><div className="domain-tabs" role="tablist" aria-label="Topological domain"><button type="button" className={domain === "graph" ? "active" : ""} onClick={() => setDomain("graph")}>graph</button><button type="button" className={domain === "simplicial" ? "active" : ""} onClick={() => setDomain("simplicial")}>simplicial</button><button type="button" className={domain === "hypergraph" ? "active" : ""} onClick={() => setDomain("hypergraph")}>hypergraph</button><button type="button" className={domain === "cc" ? "active" : ""} onClick={() => setDomain("cc")}>combinatorial complex</button></div></div>
    <div className="domain-stage">
      <div className={`domain-canvas domain-${domain}`}>
        {domain === "graph" && <svg viewBox="0 0 430 245" role="img" aria-label="Graph with five vertices and six edges"><g className="graph-links"><line x1="70" y1="55" x2="205" y2="38"/><line x1="205" y1="38" x2="355" y2="76"/><line x1="70" y1="55" x2="122" y2="185"/><line x1="122" y1="185" x2="290" y2="197"/><line x1="290" y1="197" x2="355" y2="76"/><line className="focus-link" x1="205" y1="38" x2="290" y2="197"/></g><g className="graph-nodes"><circle cx="70" cy="55" r="14"/><circle cx="205" cy="38" r="14"/><circle cx="355" cy="76" r="14"/><circle cx="122" cy="185" r="14"/><circle cx="290" cy="197" r="14"/></g><text x="250" y="107">B₁: edge → signed endpoints</text><path className="diagram-leader" d="M250 114 L252 139"/></svg>}
        {domain === "simplicial" && <svg viewBox="0 0 430 245" role="img" aria-label="Two triangles sharing an edge, one filled and one unfilled"><polygon className="domain-face" points="56,190 165,42 235,188"/><g className="graph-links"><line x1="56" y1="190" x2="165" y2="42"/><line x1="165" y1="42" x2="235" y2="188"/><line x1="235" y1="188" x2="56" y2="190"/><line className="focus-link" x1="235" y1="188" x2="354" y2="61"/><line x1="354" y1="61" x2="165" y2="42"/></g><g className="graph-nodes"><circle cx="56" cy="190" r="12"/><circle cx="165" cy="42" r="12"/><circle cx="235" cy="188" r="12"/><circle cx="354" cy="61" r="12"/></g><text x="130" y="128">2-cell</text><text x="307" y="126">cycle only</text></svg>}
        {domain === "hypergraph" && <svg viewBox="0 0 430 245" role="img" aria-label="Hypergraph with five vertices and three overlapping hyperedges"><ellipse className="hyperedge h1" cx="142" cy="126" rx="112" ry="92"/><ellipse className="hyperedge h2" cx="282" cy="109" rx="112" ry="74"/><ellipse className="hyperedge h3" cx="260" cy="171" rx="88" ry="55"/><g className="graph-nodes"><circle cx="72" cy="95" r="13"/><circle cx="145" cy="57" r="13"/><circle cx="202" cy="130" r="13"/><circle cx="315" cy="76" r="13"/><circle cx="289" cy="188" r="13"/></g><text x="71" y="52">{"e₁={1,2,3}"}</text><text x="338" y="38">{"e₂={2,3,4}"}</text><text x="315" y="229">{"e₃={3,5}"}</text></svg>}
        {domain === "cc" && <svg viewBox="0 0 430 245" role="img" aria-label="Ranked combinatorial complex Hasse-style view"><g className="rank-guides"><line x1="22" y1="205" x2="408" y2="205"/><line x1="22" y1="148" x2="408" y2="148"/><line x1="22" y1="91" x2="408" y2="91"/><line x1="22" y1="34" x2="408" y2="34"/></g><g className="cc-links"><line x1="82" y1="197" x2="135" y2="140"/><line x1="190" y1="197" x2="135" y2="140"/><line x1="190" y1="197" x2="248" y2="140"/><line x1="339" y1="197" x2="248" y2="140"/><line x1="135" y1="140" x2="210" y2="83"/><line x1="248" y1="140" x2="210" y2="83"/><line className="focus-link" x1="248" y1="140" x2="338" y2="83"/><line x1="210" y1="83" x2="270" y2="27"/><line x1="338" y1="83" x2="270" y2="27"/></g><g className="cc-cells"><circle cx="82" cy="197" r="10"/><circle cx="190" cy="197" r="10"/><circle cx="339" cy="197" r="10"/><rect x="120" y="132" width="30" height="16" rx="5"/><rect x="233" y="132" width="30" height="16" rx="5"/><path d="M193 86 L210 71 L227 86 Z"/><path d="M321 88 Q338 66 355 88 Z"/><rect x="246" y="18" width="48" height="18" rx="8"/></g><text x="14" y="201">r0</text><text x="14" y="144">r1</text><text x="14" y="87">r2</text><text x="14" y="30">r3</text></svg>}
      </div>
      <div className="domain-copy"><span>{copy.title}</span><button type="button" onClick={() => setSelected(domain === "simplicial" ? "hodge" : domain === "graph" ? "lowerLap" : "G")}>{copy.formula}</button><p>{copy.text}</p><div><b>Boundary:</b> {copy.caveat}</div></div>
    </div>
  </section>;
}

function RaiseLowerView({ selected, setSelected }: { selected: TermKey; setSelected: (id: TermKey) => void }) {
  const [filled, setFilled] = useState(false);
  const [signal, setSignal] = useState<"cycle" | "edge">("cycle");
  const [downGate, setDownGate] = useState(1);
  const [upGate, setUpGate] = useState(1);
  const [regime, setRegime] = useState<"rank" | "filtration" | "sheaf">("rank");
  const h = signal === "cycle" ? [1, 1, 1] : [1, 0, 0];
  const lowerMatrix = [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]];
  const upperMatrix = filled ? [[1, 1, 1], [1, 1, 1], [1, 1, 1]] : [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const mul = (matrix: number[][]) => matrix.map(row => row.reduce((sum, value, i) => sum + value * h[i], 0));
  const lower = mul(lowerMatrix);
  const upper = mul(upperMatrix);
  const output = lower.map((value, i) => downGate * value + upGate * upper[i]);
  const fmt = (values: number[]) => `[${values.map(value => Number(value.toFixed(1))).join(", ")}]`;
  const matrixText = (matrix: number[][]) => matrix.map(row => row.join("  "));

  return <div className="work-area raise-lower-area">
    <div className="synthetic-ribbon"><span className="toy-badge">synthetic data</span><p>Every domain below is a runnable toy graph, hypergraph, or ranked complex—not a decorative schematic.</p></div>
    <DomainExplorer setSelected={setSelected}/>
    <div className="rl-controls">
      <div className="toggle-pair" role="group" aria-label="Triangle topology"><button type="button" className={!filled ? "active" : ""} onClick={() => setFilled(false)}>△ hole · no 2-cell</button><button type="button" className={filled ? "active" : ""} onClick={() => setFilled(true)}>▲ filled · add 2-cell</button></div>
      <div className="toggle-pair" role="group" aria-label="Input edge signal"><button type="button" className={signal === "cycle" ? "active" : ""} onClick={() => setSignal("cycle")}>h = [1,1,1] circulation</button><button type="button" className={signal === "edge" ? "active" : ""} onClick={() => setSignal("edge")}>h = [1,0,0] one edge</button></div>
    </div>

    <div className="simplex-lab">
      <div className="triangle-wrap">
        <svg viewBox="0 0 260 225" role="img" aria-label={filled ? "Filled oriented triangle with three edges" : "Unfilled oriented triangle cycle with three edges"}>
          {filled && <polygon className="face-fill" points="130,25 25,198 235,198"/>}
          <line className={signal === "edge" ? "edge-line hot" : "edge-line"} x1="130" y1="25" x2="25" y2="198"/>
          <line className="edge-line" x1="25" y1="198" x2="235" y2="198"/>
          <line className="edge-line" x1="235" y1="198" x2="130" y2="25"/>
          <path className="edge-arrow" d="M84 105 L75 122 L94 120"/><path className="edge-arrow" d="M113 198 L133 198 L127 188"/><path className="edge-arrow" d="M188 119 L178 103 L173 122"/>
          <circle cx="130" cy="25" r="8"/><circle cx="25" cy="198" r="8"/><circle cx="235" cy="198" r="8"/>
          <text x="131" y="13">v₁</text><text x="4" y="220">v₂</text><text x="236" y="220">v₃</text>
          <text x="67" y="92">e₁</text><text x="130" y="219">e₂</text><text x="195" y="92">e₃</text>
          {filled && <text className="face-label" x="130" y="145">f₁₂₃</text>}
        </svg>
        <div className={`betti-readout ${filled ? "filled" : "hole"}`}><span>β₁</span><b>{filled ? "0" : "1"}</b><small>{filled ? "cycle is a boundary" : "one harmonic loop"}</small></div>
      </div>

      <div className="roundtrips">
        <button type="button" className={`trip-card lower-trip ${selected === "lowerLap" ? "active" : ""}`} onClick={() => setSelected("lowerLap")}>
          <div className="trip-title"><span>LOWER NEIGHBORHOOD</span><b>B₁ᵀ B₁</b></div>
          <div className="trip-path"><i>edges C¹</i><em> B₁ ↓ </em><i>vertices C⁰</i><em> B₁ᵀ ↑ </em><i>edges C¹</i></div>
          <p>Edges compare through shared endpoints.</p>
          <strong>{fmt(h)} → {fmt(lower)}</strong>
        </button>
        <button type="button" className={`trip-card upper-trip ${selected === "upperLap" ? "active" : ""}`} onClick={() => setSelected("upperLap")}>
          <div className="trip-title"><span>UPPER NEIGHBORHOOD</span><b>B₂ B₂ᵀ</b></div>
          <div className="trip-path"><i>edges C¹</i><em> B₂ᵀ ↑ </em><i>faces C²</i><em> B₂ ↓ </em><i>edges C¹</i></div>
          <p>{filled ? "Edges compare through the face they jointly bound." : "No face exists, so this entire route is zero."}</p>
          <strong>{fmt(h)} → {fmt(upper)}</strong>
        </button>
      </div>
    </div>

    <div className="hodge-stage">
      <div className="equation equation-hodge">
        <MathTerm id="hodge" selected={selected} onSelect={setSelected}>L<sub>1</sub>h</MathTerm><span>=</span>
        <MathTerm id="lowerLap" selected={selected} onSelect={setSelected}>a<sub>↓</sub>B<sub>1</sub><sup>T</sup>B<sub>1</sub>h</MathTerm><span>+</span>
        <MathTerm id="upperLap" selected={selected} onSelect={setSelected}>a<sub>↑</sub>B<sub>2</sub>B<sub>2</sub><sup>T</sup>h</MathTerm>
      </div>
      <div className="gate-grid">
        <label><span><i className="dot cyan"/> lower-channel attention a↓</span><b>{downGate.toFixed(1)}</b><input aria-label="Lower channel attention" type="range" min="0" max="1" step="0.1" value={downGate} onChange={event => setDownGate(Number(event.target.value))}/></label>
        <label><span><i className="dot pink"/> upper-channel attention a↑</span><b>{upGate.toFixed(1)}</b><input aria-label="Upper channel attention" type="range" min="0" max="1" step="0.1" value={upGate} onChange={event => setUpGate(Number(event.target.value))}/></label>
        <div className="output-vector"><span>weighted output</span><b>{fmt(output)}</b></div>
      </div>
      <p className="sim-note">The sliders are a simplified channel-level attention model. SAN can learn finer weights separately inside the lower and upper neighborhoods.</p>
    </div>

    <div className="gram-section">
      <div className="gram-copy"><p className="eyebrow">THE “INNER / OUTER” INTUITION</p><h3>They are two Gram products, not two mystical operators</h3><p><b>BᵀB</b> takes inner products between columns of B; <b>BBᵀ</b> takes inner products between rows. Equivalently, each can be decomposed as a sum of vector outer products. The transpose sits on a different side, so the product closes on a different space.</p></div>
      <div className="matrix-deck">
        <button type="button" onClick={() => setSelected("lowerLap")}><span>B₁ᵀB₁ · columns meet</span>{matrixText(lowerMatrix).map((row,i) => <code key={i}>{row}</code>)}</button>
        <button type="button" className={!filled ? "muted-matrix" : ""} onClick={() => setSelected("upperLap")}><span>B₂B₂ᵀ · rows meet</span>{matrixText(upperMatrix).map((row,i) => <code key={i}>{row}</code>)}</button>
      </div>
    </div>

    <div className="map-regimes">
      <div className="regime-tabs" role="tablist" aria-label="Push and pull regimes"><button type="button" className={regime === "rank" ? "active" : ""} onClick={() => setRegime("rank")}>inside one complex</button><button type="button" className={regime === "filtration" ? "active" : ""} onClick={() => setRegime("filtration")}>across a filtration</button><button type="button" className={regime === "sheaf" ? "active" : ""} onClick={() => setRegime("sheaf")}>map / sheaf</button></div>
      {regime === "rank" && <div className="regime-body"><div className="rank-column"><i>C<sup>k+1</sup></i><button type="button" onClick={() => setSelected("boundary")}>Bₖ₊₁ ↓</button><i>C<sup>k</sup></i><button type="button" onClick={() => setSelected("coboundary")}>Bₖᵀ ↑</button><i>C<sup>k−1</sup></i></div><div><h4>Adjoint rank maps</h4><p>One incidence matrix is read in two directions. A single arrow is a valid <b>cross-rank</b> update; only a <b>same-rank</b> incidence operator must leave and return.</p></div></div>}
      {regime === "filtration" && <div className="regime-body filtration-body"><div className="filtration-diagram"><div><b>Xₛ</b><span>old cells</span></div><div className="filtration-arrows"><button type="button" onClick={() => setSelected("restriction")}>ι* canonical ←</button><button type="button" className="danger" onClick={() => setSelected("extension")}>extension choice →</button></div><div><b>Xₜ</b><span>old + new cells</span></div></div><div><h4>Now there really are two spaces</h4><p>For Xₛ ⊂ Xₜ, cochains restrict from large to small canonically. Zero-extension back to the larger complex generally fails to commute with δ.</p></div></div>}
      {regime === "sheaf" && <div className="regime-body sheaf-body"><div className="sheaf-map"><i>Vₓ</i><span>ρₓ→ᵧ</span><i>Vᵧ</i></div><div><h4>Translate local representational languages</h4><p>A genuine map f:X→Y or a sheaf restriction map adds semantics beyond incidence: it says how coordinates in one local space become coordinates in another.</p></div></div>}
    </div>

    <button type="button" className={`harmonic-callout ${selected === "harmonic" ? "active" : ""}`} onClick={() => setSelected("harmonic")}><span>HARMONIC CHECK</span><b>{filled ? "The face closes the hole: ker L₁ has dimension 0." : "Circulation survives: L₁[1,1,1] = 0 and dim ker L₁ = β₁ = 1."}</b><small>Pure Hodge diffusion leaves harmonic modes fixed; neural residuals or explicit harmonic channels can still carry them.</small></button>
  </div>;
}

function DynamicsView({ selected, setSelected }: { selected: TermKey; setSelected: (id: TermKey) => void }) {
  const [context, setContext] = useState<"neural" | "fluid">("neural");
  const [target, setTarget] = useState(2);
  const config = context === "neural"
    ? { labels: ["neuron", "interaction", "assembly", "area state"], states: [.9, .55, .35, .72], source: .18, sink: .12, memory: .06, localRate: -.14 }
    : { labels: ["mesh cell", "vortex motif", "resolved mode", "coarse state"], states: [1.2, .86, .52, .28], source: .32, sink: .24, memory: -.04, localRate: -.08 };
  const incoming = config.states.map((state, source) => {
    const active = Math.abs(source - target) === 1;
    const gate = source < target ? .72 : .46;
    const transport = source < target ? 1.1 : .85;
    const message = pretty(state - config.states[target]);
    return { source, active, gate, transport, message, contribution: active ? pretty(gate * transport * message) : 0 };
  }).filter(route => route.active);
  const local = pretty(config.localRate * config.states[target]);
  const coupling = pretty(incoming.reduce((sum, route) => sum + route.contribution, 0));
  const derivative = pretty(local + coupling + config.memory + config.source - config.sink);
  const nextState = pretty(config.states[target] + .1 * derivative);
  const labels = config.labels;
  return <div className="work-area dynamics-area">
    <div className="context-toggle" role="group" aria-label="Example context"><button type="button" className={context === "neural" ? "active" : ""} onClick={() => setContext("neural")}>neural example</button><button type="button" className={context === "fluid" ? "active" : ""} onClick={() => setContext("fluid")}>fluid example</button></div>
    <div className="equation-stage dynamics-stage"><div className="equation-kicker">proposed synthesis · not a standard HOMP identity</div><div className="equation equation-dynamics">
      <MathTerm id="derivative" selected={selected} onSelect={setSelected}>ḣ<sub>r</sub></MathTerm><span>=</span><MathTerm id="localDynamics" selected={selected} onSelect={setSelected}>f<sub>r</sub>(h<sub>r</sub>)</MathTerm><span>+</span><span>Σ<sub>s</sub></span><MathTerm id="gate" selected={selected} onSelect={setSelected}>α<sub>sr</sub>(t)</MathTerm><MathTerm id="transport" selected={selected} onSelect={setSelected}>T<sub>sr</sub></MathTerm><MathTerm id="flux" selected={selected} onSelect={setSelected}>m<sub>sr</sub></MathTerm><span>+</span><MathTerm id="memory" selected={selected} onSelect={setSelected}>M<sub>r</sub>[h(τ&lt;t)]</MathTerm><span>+</span><MathTerm id="source" selected={selected} onSelect={setSelected}>S<sub>r</sub></MathTerm><span>−</span><MathTerm id="sink" selected={selected} onSelect={setSelected}>D<sub>r</sub></MathTerm>
    </div></div>
    <section className="synthetic-panel dynamics-toy" aria-label="Synthetic multiscale dynamics graph">
      <div className="synthetic-head"><div><span className="toy-badge">synthetic data</span><h3>{context === "neural" ? "Cross-scale neural state update" : "Coarse-grained fluid state update"}</h3></div><p>Click a rank node to make it the receiver and recompute every term.</p></div>
      <svg viewBox="0 0 760 320" role="img" aria-label="Four scale nodes with directional cross-scale messages, a source, sink, and memory loop">
        <defs><marker id="dynamics-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
        <g className="scale-links" onClick={() => setSelected("flux")}>{[0, 1, 2].map(i => <g key={i}><line className={target === i || target === i + 1 ? "active" : ""} x1={138 + i * 170} y1="168" x2={242 + i * 170} y2="168" markerEnd="url(#dynamics-arrow)"/><line className={target === i || target === i + 1 ? "active reverse" : "reverse"} x1={242 + i * 170} y1="184" x2={138 + i * 170} y2="184" markerEnd="url(#dynamics-arrow)"/></g>)}</g>
        {labels.map((label, i) => <g key={label} className={`scale-node ${i === target ? "target" : ""}`} onClick={() => setTarget(i)}><rect x={58 + i * 170} y="129" width="112" height="94" rx="17"/><text className="rank-label" x={114 + i * 170} y="151">rank r{i}</text><text x={114 + i * 170} y="174">{label}</text><text className="toy-value" x={114 + i * 170} y="198">h = {config.states[i]}</text><text className="select-label" x={114 + i * 170} y="214">{i === target ? "RECEIVER" : "click to receive"}</text></g>)}
        <g className="source-injection" onClick={() => setSelected("source")}><rect x={73 + target * 170} y="32" width="82" height="43" rx="10"/><text x={114 + target * 170} y="50">source S</text><text className="toy-value" x={114 + target * 170} y="66">+{config.source}</text><line x1={114 + target * 170} y1="78" x2={114 + target * 170} y2="123" markerEnd="url(#dynamics-arrow)"/></g>
        <g className="sink-drain" onClick={() => setSelected("sink")}><line x1={114 + target * 170} y1="228" x2={114 + target * 170} y2="263" markerEnd="url(#dynamics-arrow)"/><rect x={73 + target * 170} y="267" width="82" height="40" rx="10"/><text x={114 + target * 170} y="284">sink D</text><text className="toy-value" x={114 + target * 170} y="299">−{config.sink}</text></g>
        <g className="memory-loop" onClick={() => setSelected("memory")}><path d={`M ${145 + target * 170} 126 C ${185 + target * 170} 82, ${43 + target * 170} 82, ${82 + target * 170} 126`} markerEnd="url(#dynamics-arrow)"/><text x={114 + target * 170} y="97">memory {config.memory >= 0 ? "+" : ""}{config.memory}</text></g>
      </svg>
      <div className="dynamics-ledger">
        <button type="button" onClick={() => setSelected("localDynamics")}><span className="violet">local</span><b>{config.localRate}·{config.states[target]} = {local}</b></button>
        {incoming.map(route => <button type="button" key={route.source} onClick={() => setSelected("gate")}><span className="orange">r{route.source} → r{target}</span><b>α {route.gate} · T {route.transport} · m {route.message} = {route.contribution}</b></button>)}
        <button type="button" onClick={() => setSelected("memory")}><span className="violet">history</span><b>M = {config.memory}</b></button>
        <button type="button" onClick={() => setSelected("derivative")} className="result"><span className="green">numeric update</span><b>ḣ{target} = {derivative} → h(t+.1) = {nextState}</b></button>
      </div>
    </section>
    <div className="balance-flow"><button className="balance-node source-node" type="button" onClick={() => setSelected("source")}>S<sub>r</sub><span>inject</span></button><div>→</div><button className="balance-node state-node" type="button" onClick={() => setSelected("derivative")}>h<sub>r</sub><span>state at r</span></button><div>⇄</div><button className="balance-node flux-node" type="button" onClick={() => setSelected("flux")}>J<sub>r↔s</sub><span>transfer</span></button><div>→</div><button className="balance-node sink-node" type="button" onClick={() => setSelected("sink")}>D<sub>r</sub><span>dissipate</span></button></div>
    <div className="three-axes">
      <button type="button" onClick={() => setSelected("rank")} className={selected === "rank" ? "active" : ""}><span className="axis-tag cyan">STRUCTURE</span><b>rank r</b><div className="rank-mini">{labels.map((label, i) => <i key={label}><em>r{i}</em>{label}</i>)}</div></button><div className="not-equal">≠</div>
      <button type="button" onClick={() => setSelected("timescale")} className={selected === "timescale" ? "active" : ""}><span className="axis-tag violet">DYNAMICS</span><b>timescale τ</b><div className="time-mini"><i>fast</i><span/><i>slow</i></div><small>rank does not guarantee speed</small></button><div className="not-equal">≠</div>
      <button type="button" onClick={() => setSelected("stalk")} className={selected === "stalk" ? "active" : ""}><span className="axis-tag purple">REPRESENTATION</span><b>local space Vₓ</b><div className="stalk-mini"><i>spikes</i><i>vector field</i><i>latent</i></div><small>T translates between languages</small></button>
    </div>
  </div>;
}

export default function Home() {
  const [lens, setLens] = useState<Lens>("sandwich");
  const [selected, setSelected] = useState<TermKey>("G");
  const info = termInfo[selected];
  const visibleTerms = useMemo<TermKey[]>(() => lens === "sandwich" ? ["G", "H", "W", "K"] : lens === "attention" ? ["G", "A", "hadamard", "H", "W", "transpose", "transport"] : lens === "homp" ? ["messageFn", "message", "neighborAttention", "intra", "channelAttention", "inter", "update"] : lens === "gccn" ? ["complex", "viewGraph", "subtensor", "omega", "rankAggregate", "layer", "readout"] : lens === "motifs" ? ["motifRoute", "motifLoop", "motifAttention", "motifParallel", "motifFFL", "motifNull"] : lens === "raiseLower" ? ["boundary", "coboundary", "lowerLap", "upperLap", "hodge", "harmonic", "restriction", "extension"] : ["derivative", "localDynamics", "gate", "transport", "flux", "memory", "source", "sink", "rank", "timescale", "stalk"], [lens]);
  const selectLens = (next: Lens) => { setLens(next); setSelected({ sandwich: "G", attention: "A", homp: "neighborAttention", gccn: "complex", motifs: "motifRoute", raiseLower: "hodge", dynamics: "transport" }[next] as TermKey); };
  return <main>
    <header className="site-header"><div className="brand-mark" aria-hidden="true"><span/><span/><span/></div><div><p className="eyebrow">INTERACTIVE MATH ANATOMY</p><h1>HOMP Anatomy Lab</h1></div><p className="header-note">Click any colored term. Same color = same mathematical job.</p></header>
    <nav className="lens-nav" aria-label="Equation lenses">{(Object.keys(lensNames) as Lens[]).map((key, index) => <button key={key} type="button" onClick={() => selectLens(key)} className={lens === key ? "active" : ""} aria-current={lens === key ? "page" : undefined}><span>0{index + 1}</span>{lensNames[key].short}</button>)}</nav>
    <section className="intro-row"><div><h2>{lensNames[lens].title}</h2><p>{lensNames[lens].note}</p></div><div className="micro-legend"><span><i className="dot cyan"/>structure</span><span><i className="dot yellow"/>state</span><span><i className="dot pink"/>feature mix</span><span><i className="dot orange"/>attention</span><span><i className="dot purple"/>transport/content</span><span><i className="dot green"/>aggregation/source</span></div></section>
    <div className="main-grid"><section className="visual-panel">{lens === "sandwich" && <OperatorSandwich selected={selected} setSelected={setSelected}/>} {lens === "attention" && <AttentionView selected={selected} setSelected={setSelected}/>} {lens === "homp" && <HompView selected={selected} setSelected={setSelected}/>} {lens === "gccn" && <GccnView selected={selected} setSelected={setSelected}/>} {lens === "motifs" && <MotifAtlas selected={selected} setSelected={setSelected}/>} {lens === "raiseLower" && <RaiseLowerView selected={selected} setSelected={setSelected}/>} {lens === "dynamics" && <DynamicsView selected={selected} setSelected={setSelected}/>}</section>
      <aside className={`inspector inspector-${info.color}`} aria-live="polite"><div className="inspector-topline"><span>{info.family}</span><b>{visibleTerms.includes(selected) ? `${visibleTerms.indexOf(selected) + 1}/${visibleTerms.length}` : "related"}</b></div><div className="selected-symbol">{info.symbol}</div><h3>{info.name}</h3><p className="meaning">{info.meaning}</p><div className="inspection-block"><span>WHAT IT DOES</span><p>{info.action}</p></div><div className="inspection-block contrast-block"><span>DON’T CONFLATE</span><p>{info.contrast}</p></div><div className="term-index">{visibleTerms.map((id) => <button type="button" key={id} className={selected === id ? "active" : ""} onClick={() => setSelected(id)} aria-label={`Select ${termInfo[id].name}`}>{termInfo[id].symbol}</button>)}</div></aside>
    </div>
    <section className="concept-map"><div className="concept-title"><p className="eyebrow">THE EIGHT QUESTIONS</p><h2>Every term earns a separate job</h2></div><div className="concept-chain">
      <button type="button" onClick={() => { selectLens("sandwich"); setSelected("G"); }}><span className="cyan">G / 𝒩</span><b>Who may talk?</b><small>topology</small></button>
      <button type="button" onClick={() => { selectLens("homp"); setSelected("message"); }}><span className="purple">m</span><b>What is said?</b><small>message</small></button>
      <button type="button" onClick={() => { selectLens("attention"); setSelected("A"); }}><span className="orange">A / a / b</span><b>How much now?</b><small>attention</small></button>
      <button type="button" onClick={() => { selectLens("dynamics"); setSelected("transport"); }}><span className="purple">T</span><b>How translate?</b><small>transport</small></button>
      <button type="button" onClick={() => { selectLens("homp"); setSelected("intra"); }}><span className="green">⊕ / ⊗</span><b>How combine?</b><small>aggregation</small></button>
      <button type="button" onClick={() => { selectLens("raiseLower"); setSelected("hodge"); }}><span><i className="cyan">BᵀB</i> + <i className="pink">BBᵀ</i></span><b>How return?</b><small>Hodge closure</small></button>
      <button type="button" onClick={() => { selectLens("dynamics"); setSelected("memory"); }}><span className="violet">M</span><b>What persists?</b><small>memory</small></button>
      <button type="button" onClick={() => { selectLens("dynamics"); setSelected("source"); }}><span><i className="green">S</i> / <i className="red">D</i></span><b>What enters/leaves?</b><small>balance</small></button>
    </div></section>
    <footer><p><b>Scope note.</b> Views 1–6 visualize push-forwards, attention-HOMP, GCCN synchronization, architectural motifs, and Hodge rank closure. View 7 is a broader synthesis with sheaf-like transports and multiscale physics.</p><div className="source-links"><a href="https://tdlbook.org/combinatorial-complex-neural-networks" target="_blank" rel="noreferrer">CCNN definitions ↗</a><a href="https://tdlbook.org/message-passing" target="_blank" rel="noreferrer">HOMP definitions ↗</a><a href="https://arxiv.org/html/2410.06530v5" target="_blank" rel="noreferrer">TopoTune / GCCN ↗</a><a href="https://arxiv.org/html/2304.10031v3" target="_blank" rel="noreferrer">Papillon tensor diagrams ↗</a><a href="https://www.weizmann.ac.il/mcb/UriAlon/sites/mcb.UriAlon/files/structure_and_function_of_the_feed-forward_loop_network_motif.pdf" target="_blank" rel="noreferrer">Alon FFL paper ↗</a><a href="https://openreview.net/pdf?id=LIDvgVjpkZr" target="_blank" rel="noreferrer">Sheaf attention ↗</a></div></footer>
  </main>;
}
