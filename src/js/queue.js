class TaskQueue {
  constructor({ utilization = 0.8, timeout = 1500 } = {}) {
    this.taskList = [];
    this.isRunning = false;
    this.timeout = timeout;
    this.utilization = utilization;

    this.run = this.run.bind(this);
  }

  put(...tasks) {
    this.taskList.push(...tasks);
    this.scheduleRun();
  }

  prioritise(task) {
    this.taskList.unshift(task);
    this.scheduleRun();
  }

  hasPending() {
    return this.taskList.length >= 1;
  }

  run(deadline) {
    if (!this.isRunning) {
      this.isRunning = true;

      do {
        const task = this.taskList.shift();
        const allotedTime = this.currentTimeLeft(deadline);
        task({ deadline: allotedTime });
      } while (this.canRun(deadline) === true);

      this.isRunning = false;
      if (this.hasPending()) this.scheduleRun();
    }
  }

  currentTimeLeft(deadline) {
    return Math.floor(deadline.timeRemaining() * this.utilization);
  }

  canRun(deadline) {
    return this.hasPending() && this.currentTimeLeft(deadline) > 0;
  }

  scheduleRun() {
    if (!this.isRunning) requestIdleCallback(this.run, { timeout: this.timeout });
  }
}

const useQueue = (opts) => {
  const queue = new TaskQueue(opts);

  // Tie async or stateful tasks together
  // Stateful tasks pass generated sate (mostly local)
  // from one task to the next
  const chain = (...tasks) => {
    const start = (payload) => {
      payload.startedAt = Date.now();
      return payload;
    };

    const finish = (payload) => {
      payload.completedAt = Date.now();
      return payload;
    };

    const timeIsUp = (payload) => {
      const now = Date.now();
      const { deadline, startedAt, continuations } = payload;
      if (!continuations) return (now - startedAt) >= deadline;

      const lastReRun = continuations.length - 1;
      const { [lastReRun]: [restartedAt, reRunDeadline] } = continuations;
      return (now - restartedAt) >= reRunDeadline;
    };

    const allTasks = [start, ...tasks, finish];

    const runAs = async (payload, todos) => {
      if (timeIsUp(payload)) {
        if (payload.continuations) {
          // we've re-ran before
          // indicate how long the last run took
          const lastRunCompletedAt = Date.now();
          payload.continuations[payload.continuations.length - 1].push(lastRunCompletedAt);
        }

        if (!todos || todos.length === 0) return payload;

        const reRunAs = ({ deadline }) => {
          if (!payload.continuations) payload.continuations = [];
          const restartedAt = Date.now();
          payload.continuations.push([restartedAt, deadline]);

          return runAs(payload, todos);
        };
        return queue.prioritise(reRunAs);
      }

      if (!todos || todos.length === 0) return payload;

      const task = todos.shift();
      const result = await task(payload);

      return runAs(result, todos);
    };

    return (data) => runAs(data, allTasks);
  };

  return [queue, chain];
};

export default useQueue;
