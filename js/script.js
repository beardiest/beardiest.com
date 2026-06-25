const parallax = document.getElementById("home");
const themeToggle = document.getElementById("themeToggle");
const root = document.documentElement;
const themeStorageKey = "beardiest-theme";

function setTheme(mode) {
	const isInvert = mode === "invert";
	root.classList.toggle("theme-invert", isInvert);

	if (themeToggle) {
		themeToggle.setAttribute("aria-pressed", String(isInvert));
		themeToggle.setAttribute(
			"title",
			isInvert ? "Switch to normal mode" : "Switch to night mode"
		);
	}
}

try {
	const savedTheme = localStorage.getItem(themeStorageKey);
	if (savedTheme === "invert") {
		setTheme("invert");
	} else {
		setTheme("normal");
	}
} catch (error) {
	setTheme(root.classList.contains("theme-invert") ? "invert" : "normal");
}

if (themeToggle) {
	themeToggle.addEventListener("click", function () {
		const nextMode = root.classList.contains("theme-invert") ? "normal" : "invert";
		setTheme(nextMode);

		try {
			localStorage.setItem(themeStorageKey, nextMode);
		} catch (error) {
			// Ignore storage errors and continue.
		}
	});
}

const bgCanvas = document.querySelector(".bg-network");
const bgGrid = document.querySelector(".bg-grid");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function layoutProjectGraphs() {
	const graphs = document.querySelectorAll(".project-graph");
	if (!graphs.length) return;

	graphs.forEach(function (graph) {
		const nodes = Array.from(graph.querySelectorAll(".project-node"));
		const edgeLayer = graph.querySelector(".project-graph-edges");
		if (!nodes.length) return;

		const positions = [];
		const centerX = 50;
		const centerY = 50;
		const ringStep = 26;
		const ellipseY = 0.72;

		for (let index = 0; index < nodes.length; index++) {
			const ring = Math.floor(Math.sqrt(index));
			if (ring === 0) {
				positions.push({ x: centerX, y: centerY, ring: 0, slot: 0 });
				continue;
			}

			const ringStart = ring * ring;
			const slot = index - ringStart;
			const capacity = ring * 2 + 1;
			const angle = -Math.PI / 2 + (slot / capacity) * Math.PI * 2 + ring * 0.35;
			const radius = 14 + ring * ringStep;
			const x = centerX + Math.cos(angle) * radius;
			const y = centerY + Math.sin(angle) * radius * ellipseY;
			positions.push({ x, y, ring, slot });
		}

		nodes.forEach(function (node, index) {
			const position = positions[index];
			node.style.setProperty("--x", position.x.toFixed(2) + "%");
			node.style.setProperty("--y", position.y.toFixed(2) + "%");
		});

		if (edgeLayer) {
			while (edgeLayer.firstChild) {
				edgeLayer.removeChild(edgeLayer.firstChild);
			}

			const svgNS = "http://www.w3.org/2000/svg";
			const addLine = function (from, to) {
				const line = document.createElementNS(svgNS, "line");
				line.setAttribute("x1", from.x.toFixed(2));
				line.setAttribute("y1", from.y.toFixed(2));
				line.setAttribute("x2", to.x.toFixed(2));
				line.setAttribute("y2", to.y.toFixed(2));
				edgeLayer.appendChild(line);
			};

			for (let index = 1; index < positions.length; index++) {
				addLine(positions[0], positions[index]);

				const current = positions[index];
				if (current.ring > 0 && current.slot > 0) {
					addLine(positions[index - 1], current);
				} else if (current.ring > 1 && current.slot === 0) {
					const previousRingFirstIndex = (current.ring - 1) * (current.ring - 1);
					addLine(positions[previousRingFirstIndex], current);
				}
			}
		}
	});
}

layoutProjectGraphs();

window.addEventListener("resize", layoutProjectGraphs);

const CMY_COLORS = ["0,255,255", "255,0,255", "255,255,0"];
const projectNodes = document.querySelectorAll(".project-node");
if (projectNodes.length && !prefersReducedMotion) {
	projectNodes.forEach(function (node) {
		const dot = node.querySelector(".project-node-dot");
		const graph = node.closest(".project-graph");
		if (!dot) return;
		if (!graph) return;
		function spawnRing() {
			const rect = dot.getBoundingClientRect();
			const graphRect = graph.getBoundingClientRect();
			const cx = rect.left - graphRect.left + rect.width / 2;
			const cy = rect.top - graphRect.top + rect.height / 2;
			const ring = document.createElement("span");
			ring.className = "project-node-ring";
			ring.style.setProperty("--ring-color", CMY_COLORS[Math.floor(Math.random() * CMY_COLORS.length)]);
			ring.style.left = cx + "px";
			ring.style.top = cy + "px";
			ring.addEventListener("animationend", function () { ring.remove(); });
			graph.appendChild(ring);
		}
		node.addEventListener("mouseenter", spawnRing);
		node.addEventListener("focus", spawnRing);
	});
}

if (!prefersReducedMotion) {
	let ticking = false;
	function updateParallax() {
		const offset = window.pageYOffset;
		if (parallax) parallax.style.setProperty("--hero-parallax-offset", offset * 0.5 + "px");
		if (bgGrid) bgGrid.style.backgroundPositionY = -offset * 0.3 + "px";
		ticking = false;
	}
	updateParallax();
	window.addEventListener("scroll", function () {
		if (!ticking) {
			window.requestAnimationFrame(updateParallax);
			ticking = true;
		}
	}, { passive: true });
}

if (bgCanvas) {
	const ctx = bgCanvas.getContext("2d");
	const NODE_DENSITY = 0.00004; // nodes per pixel of viewport area
	const LINK_DISTANCE = 260;
	const CURSOR_RADIUS = 90;
	const CURSOR_PUSH = 2.0;
	const SPRING = 0.045;   // pull back to home position
	const DAMPING = 0.82;   // velocity damping per frame
	const SCROLL_PARALLAX = 0.3; // matches .bg-grid scroll rate

	let nodes = [];
	let width = 0;
	let height = 0;
	let dpr = window.devicePixelRatio || 1;
	let mouseX = -9999;
	let mouseY = -9999;
	let scrollOffset = 0;

	function resize() {
		dpr = window.devicePixelRatio || 1;
		width = window.innerWidth;
		height = window.innerHeight;
		bgCanvas.width = Math.floor(width * dpr);
		bgCanvas.height = Math.floor(height * dpr);
		bgCanvas.style.width = width + "px";
		bgCanvas.style.height = height + "px";
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const count = Math.max(16, Math.round(width * height * NODE_DENSITY));
		// Dot grid is 28px tiles with the dot centered → centers at (14 + 28k, 14 + 28k).
		const GRID = 28;
		const OFFSET = GRID / 2;
		const cols = Math.floor((width - OFFSET) / GRID) + 1;
		const rows = Math.floor((height - OFFSET) / GRID) + 1;
		const used = new Set();
		nodes = [];
		let attempts = 0;
		while (nodes.length < count && attempts < count * 20) {
			attempts++;
			const ci = Math.floor(Math.random() * cols);
			const ri = Math.floor(Math.random() * rows);
			const key = ri * cols + ci;
			if (used.has(key)) continue;
			used.add(key);
			const hx = OFFSET + ci * GRID;
			const hy = OFFSET + ri * GRID;
			nodes.push({ x: hx, y: hy, hx: hx, hy: hy, vx: 0, vy: 0, wrap: 0 });
		}
	}

	function step() {
		const newScrollOffset = window.pageYOffset * SCROLL_PARALLAX;
		const scrollDelta = newScrollOffset - scrollOffset;
		scrollOffset = newScrollOffset;
		ctx.clearRect(0, 0, width, height);

		for (let i = 0; i < nodes.length; i++) {
			const n = nodes[i];
			// Translate node with scroll so its offset from home is preserved.
			n.y -= scrollDelta;
			const rawHome = n.hy - scrollOffset;
			const homeY = ((rawHome % height) + height) % height;
			// keep node's rendered y in the same wrapped period as homeY
			const yDelta = homeY - rawHome;
			n.y += yDelta - n.wrap;
			n.wrap = yDelta;

			const dxm = n.x - mouseX;
			const dym = n.y - mouseY;
			const dm2 = dxm * dxm + dym * dym;
			if (dm2 < CURSOR_RADIUS * CURSOR_RADIUS) {
				const dm = Math.sqrt(dm2) || 1;
				const force = (1 - dm / CURSOR_RADIUS) * CURSOR_PUSH;
				n.vx += (dxm / dm) * force;
				n.vy += (dym / dm) * force;
			}

			n.vx += (n.hx - n.x) * SPRING;
			n.vy += (homeY - n.y) * SPRING;
			n.vx *= DAMPING;
			n.vy *= DAMPING;
			n.x += n.vx;
			n.y += n.vy;
		}

		for (let i = 0; i < nodes.length; i++) {
			const a = nodes[i];
			for (let j = i + 1; j < nodes.length; j++) {
				const b = nodes[j];
				const dx = a.x - b.x;
				const dy = a.y - b.y;
				const d2 = dx * dx + dy * dy;
				if (d2 < LINK_DISTANCE * LINK_DISTANCE) {
					const alpha = (1 - Math.sqrt(d2) / LINK_DISTANCE) * 0.20;
					ctx.strokeStyle = "rgba(0,0,0," + alpha + ")";
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(a.x, a.y);
					ctx.lineTo(b.x, b.y);
					ctx.stroke();
				}
			}
		}

		ctx.fillStyle = "rgba(30, 30, 30, 0.35)";
		for (let i = 0; i < nodes.length; i++) {
			const n = nodes[i];
			ctx.beginPath();
			ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
			ctx.fill();
		}

		requestAnimationFrame(step);
	}

	window.addEventListener("resize", resize);
	window.addEventListener("mousemove", function (e) {
		mouseX = e.clientX;
		mouseY = e.clientY;
	}, { passive: true });
	window.addEventListener("mouseleave", function () {
		mouseX = -9999;
		mouseY = -9999;
	});

	resize();
	requestAnimationFrame(step);
}