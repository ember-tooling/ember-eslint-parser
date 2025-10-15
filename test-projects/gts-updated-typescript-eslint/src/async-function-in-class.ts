import type { PopupHandle } from "@test-project/types-providing-uses-ember-concurrency";

export class Demo {
	reset = async (popup: PopupHandle) => {
		await popup.closeTask.perform();
	};
}
