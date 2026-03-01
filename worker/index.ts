function main() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] worker up`);
  setInterval(() => {
    const now = new Date().toISOString();
    console.log(`[${now}] worker heartbeat`);
  }, 30000);
}
main();
