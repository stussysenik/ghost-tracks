<script lang="ts">
  import { onMount } from 'svelte';
  import c from 'cassowary';

  let container: HTMLDivElement;
  let box1: HTMLDivElement;
  let box2: HTMLDivElement;

  onMount(() => {
    const solver = new c.Solver();
    
    // Variables for positions and sizes
    const b1_left = new c.Variable({ name: 'b1_left' });
    const b1_width = new c.Variable({ name: 'b1_width' });
    const b2_left = new c.Variable({ name: 'b2_left' });
    const b2_width = new c.Variable({ name: 'b2_width' });
    const container_width = new c.Variable({ name: 'container_width' });

    // Constraints
    solver.addConstraint(new c.Equation(b1_left, 10)); // Box 1 starts at 10px
    solver.addConstraint(new c.Equation(b1_width, 100)); // Box 1 is 100px wide
    solver.addConstraint(new c.Equation(b2_left, new c.Expression(b1_left, b1_width, 20))); // Box 2 is 20px after Box 1
    solver.addConstraint(new c.Equation(b2_width, 150)); // Box 2 is 150px wide

    // Apply values to DOM
    const update = () => {
      box1.style.left = `${b1_left.value}px`;
      box1.style.width = `${b1_width.value}px`;
      box2.style.left = `${b2_left.value}px`;
      box2.style.width = `${b2_width.value}px`;
    };

    solver.solve();
    update();
  });
</script>

<div bind:this={container} class="relative h-20 w-full bg-gray-100 border border-dashed">
  <div bind:this={box1} class="absolute h-10 bg-blue-500 text-white flex items-center justify-center">Box 1</div>
  <div bind:this={box2} class="absolute h-10 bg-green-500 text-white flex items-center justify-center">Box 2</div>
</div>

<style>
  .relative { position: relative; }
  .absolute { position: absolute; }
</style>
