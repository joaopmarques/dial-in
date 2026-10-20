# JS values

Knobs with `kind: "js"`: values that live in JavaScript, not CSS. Springs, durations passed to a motion library, stagger delays, Three.js uniforms, canvas parameters.

The panel exposes:

- `globalThis.__tweak(id, key, original)`: returns the live value, or `original` before the panel loads.
- A `tweak` event on `window` after every change. `event.detail` is `{ id, key, value }`.

Always read through optional chaining, so the code still runs when the panel is absent: `globalThis.__tweak?.(id, key, original) ?? original`.

## React

Add this hook once, at the top level of the file that uses it, tagged as scaffold. It starts from the original value, so server and client render the same HTML.

```tsx
// tweak-scaffold: start
function useTweak<T>(id: string, key: string, original: T): T {
  const [value, setValue] = useState<T>(original);
  useEffect(() => {
    const read = () => setValue((globalThis as any).__tweak?.(id, key, original) ?? original);
    read();
    window.addEventListener('tweak', read);
    return () => window.removeEventListener('tweak', read);
  }, [id, key]);
  return value;
}
// tweak-scaffold: end
```

Then, in the component body:

```tsx
const stiffness = useTweak('card', 'stiffness', 300); // tweak-scaffold
<motion.div transition={{ type: 'spring', stiffness }} />
```

Add the `useState` / `useEffect` imports if the file lacks them, and tag that import line too.

## Vue

```ts
const stiffness = ref(300); // tweak-scaffold
const readStiffness = () => (stiffness.value = globalThis.__tweak?.('card', 'stiffness', 300) ?? 300); // tweak-scaffold
onMounted(() => { readStiffness(); window.addEventListener('tweak', readStiffness); }); // tweak-scaffold
onBeforeUnmount(() => window.removeEventListener('tweak', readStiffness)); // tweak-scaffold
```

## Svelte

```svelte
<script>
  let stiffness = 300; // tweak-scaffold
  onMount(() => { /* tweak-scaffold */
    const read = () => (stiffness = globalThis.__tweak?.('card', 'stiffness', 300) ?? 300);
    read();
    window.addEventListener('tweak', read);
    return () => window.removeEventListener('tweak', read);
  });
</script>
```

## Render loops (Three.js, canvas, WebGL)

Read the value every frame. No event wiring needed:

```js
material.uniforms.uSpeed.value = globalThis.__tweak?.('hero', 'speed', 1.2) ?? 1.2; // tweak-scaffold
```

## Plain JS

Read the value where it is used. If it is read only once (at setup), re-run that setup on the `tweak` event, or move the read to where the value is consumed.

## Write back

1. Replace each `useTweak(…)`, `ref` + `onMounted` block, or `__tweak(…)` expression with the literal new value, written the way the original line wrote it.
2. Restore unchanged knobs to their exact `raw` text.
3. Remove the `useTweak` hook definition and any import you added for it.
