import { createApp } from "./app.js";
import { DiagramStore } from "./store.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp(new DiagramStore());

app.listen(port, () => {
  console.log(`Architecture Diagram Builder listening on http://localhost:${port}`);
});
