/**
 * @File Batching based on instant execution
 * 	Calculates the times a script needs to be finished and executes them instantly
 * 	instead of letting them active and wait for the execution
 * 
 * 	Method used (repeated): hack -> weaken -> grow -> weaken
 * 
 * 	"action" A hack, weaken or grow
 * 	"batch" A set of a hack/weaken/grow or weaken
 */

// import { isServerPrepared, default as prepareServer } from "/server_preparation.js";
// import getMostValuableServer from "/server_informations.js";

import { getArgumentValue } from "/scripts/utility/arguments.js";

const _actionScripts = {
	hack: "instant_hack.js",
	grow: "instant_grow.js",
	weaken: "instant_weaken.js"
};

const _actionsOrders = {
	// Basic batch set
	"hwgw": ["hack", "weaken", "grow", "weaken"],
	// Server below min security of 9
	"hgw": ["hack", "grow", "weaken"],
	// Prepare server for getting hacked with a Hacking method batching
	"gw": ["grow", "weaken"],
	"w": ["weaken"]
};

const _usedThreads = {
	hack: 1,
	grow: 1,
	weaken: 1
};

/** @param {NS} ns **/
export const executeActionBatcher = async (ns, givenOptions) => {

	// To give the user a gentle hint to await this function
	await ns.sleep(10);

	/**
	const targetServer = !ns.fileExists("Formulas.exe")
		? ns.getServer(givenOptions.targetHost)
		: {
			...server,
			hackDifficulty: server.minDifficulty,
			moneyAvailable: server.moneyMax
		};
	const hostingServer = ns.getServer(givenOptions.hostingHost);
	
	const oneThreadHackPercentage = ns.fileExists("Formulas.exe")
		? ns.formulas.hacking.hackPercent(targetServer, ns.getPlayer())
		: ns.hackAnalyze(givenOptions.targetHost);
	const oneThreadHackedMoney = targetServer.moneyMax * oneThreadHackPercentage;
	const fullHackThreads = targetServer.moneyMax / oneThreadHackedMoney;
	const oneThreadGrowPercentage = ns.fileExists("Formulas.exe")
		? ns.formulas.hacking.growPercent(targetServer, 1, ns.getPlayer(), homeServer.cpuCores)
		: ns.growthAnalyze(givenOptions.targetHost, 1 + oneThreadHackPercentage);
	const fullGrowThreads = 100 / (oneThreadGrowPercentage);
	const counterGrowThreads = oneThreadHackPercentage / (oneThreadGrowPercentage);

	_usedThreads.hack = 1;
	_usedThreads.grow = counterGrowThreads;
	_usedThreads.weaken = (
		_usedThreads.grow * ns.growthAnalyzeSecurity(_usedThreads.grow) +
		_usedThreads.hack * ns.hackAnalyzeSecurity(_usedThreads.hack)
	) / ns.weakenAnalyze(1, hostingServer.cpuCores);
	
	const security = ns.getServerSecurityLevel(givenOptions.targetHost);
	const minSecurity = ns.getServerMinSecurityLevel(givenOptions.targetHost);
	const isServerSecurityPrepared = (targetHost) => true &&
		security <= minSecurity;
	
	ns.getPlayer().hacking < ns.getServerRequiredHackingLevel(givenOptions.targetHost)
		? !void ns.tprint("ERROR You do not possess the required hackinglevel you noob.")
		: !ns.fileExists("Formulas.exe") && isServerSecurityPrepared()
			? !void ns.tprint("WARNING No Formulas.exe found.") &&
				!void ns.tprint(`WARNING Results are calculated on the current state of the server's security ${security}/${minSecurity}`)
			: ns.tprint(givenOptions.targetHost, JSON.stringify(_usedThreads, undefined, 2));
	*/
	

	// Some options are untouchable by the user

	let parsedOptions = {
		// targetHost: "fulcrumassets",
		hostingHost: "home",
		targetHost: "n00dles",
		batchingMethod: null,
		maxBatches: 0,
		actionInterval: 1000,
		customGlobalTimeOffset: 100,
		feedbackPort: 1,
		hasBatchingCompleted: () => false,
		batchLogFile: null,
		doDebugging: false,
		simulateBatching: false,
		middleware: [],
		...givenOptions
	};
	parsedOptions.batchLogFile = "/temp/" + parsedOptions.batchingMethod + "_method_batcher_log.txt";
	parsedOptions.doPrintConfig = parsedOptions.doDebugging || givenOptions.doPrintConfig;
	Object.freeze(parsedOptions);

	// @todo get most valuable host to hack
	// const targetHost = targetHost ?? await getMostValuableServer(ns);
	const {
		hostingHost,
		targetHost,
		batchingMethod,
		maxBatches,
		actionInterval,
		hasBatchingCompleted,
		customGlobalTimeOffset,
		feedbackPort,
		batchLogFile,
		doDebugging,
		doPrintConfig,
		simulateBatching,
	} = parsedOptions;
	
	// @note maxActions isn't very practical so i won't implement it when you can set the maximum batches already
	// const allowedRam = parsedOptions.allowedRam; // limit ram usage with this value
	// const batchingOrder = parsedOptions.batchingOrder; // Same as the actions order but with batch methods @example ["gw", "hwgw"]

	// Initial helper functions
	const actionsOrder = _actionsOrders[batchingMethod];
	const isBatchingMethodValid = () => Object.keys(_actionsOrders).includes(batchingMethod);

	// Verification
	try {

		if (!ns.serverExists(hostingHost)) {
			throw `Hosting hostname "${hostingHost}" is invalid`;
		}

		if (!ns.hasRootAccess(hostingHost)) {
			throw `No root access on the hosting server "${hostingHost}"`;
		}
		
		if (!ns.serverExists(targetHost)) {
			throw `Hostname "${targetHost}" is invalid`;
		}

		if (!ns.hasRootAccess(targetHost)) {
			throw `No root access on the targeted server "${targetHost}"`;
		}

		if (!isBatchingMethodValid()) {
			throw `Batching method "${batchingMethod}" could not be found: Given batching methods ${Object.keys(_actionsOrders).join(", ")}`;
		}

		const notFoundScripts = [];

		actionsOrder.forEach((actionKey) => (
			!ns.fileExists(_actionScripts[actionKey]) &&
				notFoundScripts.push(_actionScripts[actionKey])
		));

		if (notFoundScripts.length) {
			throw `Action script(s) of action(s) "${notFoundScripts.join(", ")}" was/were not found`;
		}

		if (maxBatches != 0 && hasBatchingCompleted && typeof hasBatchingCompleted !== "function") {
			throw `Invalid hasBatchingCompleted type. Expected function or undefined.\n
				Either set a maximum batch value or fix the option`;
		}
	}
	catch(errorMessage) {
		return !void ns.tprint("Batch execution cancelled. An error occured") && !void ns.tprint(`ERROR ${errorMessage}`);
	}

	// Rest of the helper functions

	const actionsTime = {
		hack: () => ns.getHackTime(targetHost),
		grow: () => ns.getGrowTime(targetHost),
		weaken: () => ns.getWeakenTime(targetHost)
	};

	// @example Returns of this functions with their defined data based on the current batching method
	// Action order ["hack", "grow", "grow", "weaken", "hack"] Returns { "hack": [0, 4], "grow": [1, 2], "weaken": [3] }
	// Action order ["grow", "weaken", "grow", "grow"] Returns { "grow": [0, 2, 3], "weaken": [1] }
	const getActionKeysIndicies = () => actionsOrder.reduce((indicies, key, index) => ({
		...indicies,
		[key]: [...(indicies[key] ?? []), index]
	}), {});

	// Time in milliseconds which globally delays all actions
	// Necessary to set up the action with the longest running time like ns.weaken
	const getGlobalTimeOffset = () => Math.max(
		...actionsOrder.map((key) => actionsTime[key]()),
		customGlobalTimeOffset
	);

	// Clean up any logs and start anew
	ns.fileExists(batchLogFile) && ns.rm(batchLogFile);

	// Condition states
	let isBatching = false;
	const doForever = maxBatches == 0;

	// Statistics
	let batchesCount = 0;
	let actionsCount = 0;

	// Batching data
	let actionsOrderIndicies = getActionKeysIndicies(batchingMethod);

	// Array of timestamps of fired actions
	let firedActionsSignatures = [];

	// The value defines how many action of x type have been executed from the current action index
	// @example
	// 	actionOrder = ["hack", "weaken", "grow", "weaken"]
	// 	actionIndex = 0 (hack)
	//
	// Since weaken has a higher running time than hack it needs to be executed earlier
	// than the order defines. The order defines the finishing order
	//
	let firedActionsOffsetCounts = Object.keys(actionsOrderIndicies)
		.reduce((counts, key) => ({ ...counts, [key]: 0 }), {});

	let actionIndex = 0;
	let batchIndex = 0;
	let executedActions = 0;
	// Since sometimes a lag can happen, this value accounts for that
	// and adds the difference between an executed script from the batcher
	// and the actual script which got executed to delay the next action in line
	// let delayedExecutionTimeCounter = 0;

	const fixedAdditionalOffsets = Math.ceil([getGlobalTimeOffset(), 100]
		.reduce((s, c) => s + c));

	// Helper
	const getActionOrderBasedActionTimes = () => Object.entries(actionsTime).reduce((times, [key, func]) => {
		return actionsOrder.includes(key) 
        	? { ...times, [key]: func }
        	: times;
	}, {});

	const getActionCountUntilFreeMatchingAction = (actionKey, debug) => {
		const indicies = actionsOrderIndicies[actionKey];
		const occurrences = indicies.length;
		const offset = firedActionsOffsetCounts[actionKey];
		const greatestActionIndex = indicies.find((index) => index >= actionIndex);
		const [hasGreatest, indiciesIndex] = [greatestActionIndex != undefined, indicies.indexOf(greatestActionIndex)];

		const adjustedIndiciesIndex = (hasGreatest ? indiciesIndex : 0) + offset
		const occurrencesOffset = Math.floor(adjustedIndiciesIndex / occurrences);

		const result = (Number(!hasGreatest) + occurrencesOffset) * actionsOrder.length
			+ indicies.at(adjustedIndiciesIndex % occurrences)
			- actionIndex;

		return result;
	};

	const getActionSignature = (actionKey, batchIndex, actionIndex) =>
		`${actionKey}-${batchIndex}-${actionIndex}`;

	const batchingStartTime = Date.now();
	let executionDelayMilliseconds = 0;
	
	// Feedback for the return object to give the user
	// an estimate (~0-15 difference) when the last action has run out as timestamp
	const lastActionFinishesAt = null;

	// @idea adjust time to sleep between actions based on the time between the shortest actions
	// Track time between actions until one batch is done and then update the sleeping time

	doPrintConfig && ns.tprint(JSON.stringify({
		parsedOptions
	}, undefined, 2));

	ns.disableLog("sleep");

	// Let's goooooooo
	while (doForever || batchIndex < maxBatches) {

		isBatching = true;

		// An action finishing time - What action is calculated below
		const finishingTime = parseInt(batchingStartTime +
			actionIndex * actionInterval +
			batchIndex * actionsOrder.length * actionInterval +
			fixedAdditionalOffsets +
			executionDelayMilliseconds
		);

		// ns.tprint("FinishingTime:", finishingTime, " - Delay:", executionDelayMilliseconds);

		const actionSignature = getActionSignature(
			actionsOrder[actionIndex],
			batchIndex,
			actionIndex
		);
		
		/**
		console.log("Calculation", {
			_: finishingTime,
			_a: actionIndex * actionInterval,
			_b: batchIndex * actionsOrder.length * actionInterval,
			_c: fixedAdditionalOffsets,
			_d: executionDelayMilliseconds,
			actionSignature,
			actionIndex,
			batchIndex,
			actionInterval,
			actionsOrderLength: actionsOrder.length,
			fixedAdditionalOffsets,
			executionDelayMilliseconds
		});
		*/

		let hasCurrentActionFired = false;

		const conditionCheckArguments = {
			targetHost,
			hostingHost,
			batchIndex,
			actionIndex,
			actionsCount,
			batchesCount,
			actionSignature,
			batchingMethod,
			actionInterval,
			firedActionsSignatures: JSON.stringify(firedActionsSignatures)
		};

		if (hasBatchingCompleted(conditionCheckArguments)) {
			isBatching = false;
			break;
		}
		
		// @hook onBeforeBatchingStart

		// Quits this loop when the action index progressed
		while (!hasCurrentActionFired) {

			// @hook onBatchLoopStart
			
			// (Live) Execution of the actions in the current order
			const timesUntilExecution = [];

			const debugLog = [];

			for (const [actionKey, getActionTime] of Object.entries(getActionOrderBasedActionTimes())) {
				const executionTimeDelay = getActionCountUntilFreeMatchingAction(actionKey) * actionInterval + executionDelayMilliseconds;
				const adjustedFinishingTime = finishingTime + executionTimeDelay;
				const timeUntilExecution = adjustedFinishingTime - Date.now() - getActionTime();
				const timeSinceFirstAction = adjustedFinishingTime - batchingStartTime - fixedAdditionalOffsets - executionDelayMilliseconds;
				const targetedActionIndex = Math.ceil((timeSinceFirstAction / actionInterval) % actionsOrder.length);
				const targetedActionBatchIndex = parseInt(timeSinceFirstAction / (actionsOrder.length * actionInterval));
				const targetedActionSignature = getActionSignature(actionKey, targetedActionBatchIndex, targetedActionIndex);


				debugLog.push({
					_: timeUntilExecution,
					actionKey,
					actionTime: getActionTime(),
					executionTimeDelay,
					adjustedFinishingTime,
					timeSinceFirstAction,
					targetedActionIndex,
					targetedActionBatchIndex,
					targetedActionSignature
				});
			}

			// Checks all actions times of the current action order
			// and checks if an action of that order needs to get executed
			// regardless of the current action index
			for (const [actionKey, getActionTime] of Object.entries(getActionOrderBasedActionTimes())) {
				
				// @hook
				
				// Since the currently looped action might not be the one currently targeted by the actionIndex
				// This value defines the delayed time until the execution of this specific action must happen
				const executionTimeDelay = getActionCountUntilFreeMatchingAction(actionKey) * actionInterval + executionDelayMilliseconds;

				// For this currently looped adjusted finishing time
				const adjustedFinishingTime = finishingTime + executionTimeDelay;

				// The time until the currently looped action needs to get executed
				// on order to finish at the time the action order defines
				//let timeUntilExecution = Infinity;
				const timeUntilExecution = adjustedFinishingTime - Date.now() - getActionTime();

				/**

				do {
					timeUntilExecution = adjustedFinishingTime - Date.now() - getActionTime();

					await ns.sleep(timeUntilExecution);

				} while (timeUntilExecution < 10);

				// Wait until the security is on min
				// @todo Check if in the current action order is at least one weaken
				const waitingStartTime = Date.now();

				while( ns.getServerSecurityLevel(targetHost) > ns.getServerMinSecurityLevel(targetHost) ) {
					ns.sleep(10);
				}
				*/

				// Passed time since the first actions finishing time
				// and this currently looped adjusted finishing time
				const timeSinceFirstAction = adjustedFinishingTime - batchingStartTime - fixedAdditionalOffsets - executionDelayMilliseconds;

				// Indicies of the currently looped action. These need to be calculated
				// because the actionIndex and batchIndex dont represent the future actions
				// but only the actions order currently targeted action
				const targetedActionIndex = Math.ceil((timeSinceFirstAction / actionInterval) % actionsOrder.length);
				const targetedActionBatchIndex = parseInt(timeSinceFirstAction / (actionsOrder.length * actionInterval));

				const targetedActionSignature = getActionSignature(actionKey, targetedActionBatchIndex, targetedActionIndex);

				// @hook onBeforeFireActionCheck

				// Going into the execution before the timer runs below 0
				// increases the precision since we already can do those 0-2 milliseconds timings
				// and answer on the early execution with a sleep if necessary
				if (timeUntilExecution < 8) {

					// Don't fire action when it's for a batch beyond the limit
					if (!doForever && targetedActionBatchIndex + 1 > maxBatches) {
						console.log("Over batchlimit", targetedActionSignature);
						break;
					}

					const script = _actionScripts[actionKey];
					const args = [
						"--target", targetHost,
						"--host", hostingHost,
						"--signature", targetedActionSignature,
						"--feedback-port", feedbackPort,
						"--logfile", batchLogFile
					];

					// @hook onBeforeActionWillFire
					
					// Usually i would like to do these actions AFTER the execution
					// but for some reason there is a very slight delay in the ns.exec function
					// which turns out to be such a long delay this counters don't increase the value
					// "quick"? enough so the loop still read an old? value
					// and therefore doesn't properly calculates the actions count in 
					// @see getActionCountUntilFreeMatchingAction
					firedActionsOffsetCounts[actionKey]++ && executedActions++;
					firedActionsSignatures.push(targetedActionSignature);

					let processId = null;

					// Delay execution if the sleep is longer to increase the chance of a perfect timing
					timeUntilExecution > 6 && await ns.sleep(0);

					// @note temporary testing threads
					const executionAttemptStartTimestamp = Date.now();

					while(true) {
						processId = !simulateBatching && ns.exec(script, hostingHost, _usedThreads[actionKey], ...args);

						if (processId) {
							break;
						}
						
						await ns.sleep(Math.max(actionInterval / 4), 100);
					}

					const executionAttemptDurationMilliseconds = Date.now() - executionAttemptStartTimestamp;

					executionDelayMilliseconds += executionAttemptDurationMilliseconds - 20 > actionInterval
						? executionAttemptDurationMilliseconds
						: 0;

					/**
					while(ns.peek(feedbackPort) === "NULL PORT DATA") {
						await ns.sleep(5);
					}

					delayedExecutionTimeCounter += ns.readPort(feedbackPort);
					
					// Information about the last executed action when the batches are limited
					if (targetedActionBatchIndex >= maxBatches && targetedActionIndex >= actionsOrder.length) {
						lastActionFinishesAt = adjustedFinishingTime;
					}
					*/
										
					await ns.write(batchLogFile, JSON.stringify({
						key: "log_execution",
						signature: targetedActionSignature,
						expectedFinishedAt: adjustedFinishingTime,
						expectedExecutedAt: adjustedFinishingTime - getActionTime(),
						expectedDuration: getActionTime(),
						test: Date.now() + getActionTime(),
						executionDelayMilliseconds,
						processId
					}) + "\n", "a");

					// @hook onAfterActionWillFire

					// @debug print process id and if successful execution + some meta data (finishingtime, executiontime, etc.)
				}
				
				timesUntilExecution.push(timeUntilExecution);
			}

			// @hook onBeforeActionSignatureCheck

			// Checks for fired action
			if (firedActionsSignatures.includes(actionSignature)) {

				// @hook
				
				firedActionsOffsetCounts[actionsOrder[actionIndex]]--;
				firedActionsSignatures.splice(firedActionsSignatures.indexOf(actionSignature), 1);

				actionsCount++;
				actionIndex = actionsCount % actionsOrder.length;
				actionIndex % actionsOrder.length < 1 && batchIndex++ && batchesCount++;

				// @debug Print removed signature and next action in order

				// @hook

				hasCurrentActionFired = true;
			}

			// @hook

			// If all logic is done wait for the shortest time to execute the next action
			await ns.sleep(
				Math.max(10, timesUntilExecution.sort((a, b) => a - b).at(0) - 10)
			);
			// await ns.sleep(25);
		}
	}

	isBatching = false;

	return {
		batchesCount,
		actionsCount,
		lastActionFinishesAt,
		batchLogFile
	};
}

/** @param {NS} ns **/
export const main = async (ns) => {	
	

	const targetHost = getArgumentValue(ns.args, "--target");

	/**
	let batchInformation = await executeActionBatcher(ns, {
		targetHost,
		batchingMethod: "gw",
		hasBatchingCompleted: () => {
			console.log(ns.getServerSecurityLevel(targetHost), "/", ns.getServerMinSecurityLevel(targetHost));

			return ns.getServerSecurityLevel(targetHost) == ns.getServerMinSecurityLevel(targetHost)
		}
	});
	
	ns.tprint("Grow, weaken: ", batchInformation);

	await ns.sleep(ns.getWeakenTime(targetHost));
	*/

	ns.tprint("Start Hacking");

	const hasBatchingCompleted = getArgumentValue(ns.args, "--batching-method") == "w"
		? () => ns.getServerSecurityLevel(targetHost) <= ns.getServerMinSecurityLevel(targetHost)
		: (getArgumentValue(ns.args, "--batching-method") == "gw"
			? (() => ns.getServerMaxMoney(targetHost) < ns.getServerMoneyAvailable(targetHost) &&
				ns.getServerMinSecurityLevel(targetHost) > ns.getServerSecurityLevel(targetHost))
			: () => false);

	const batchInformation = await executeActionBatcher(ns, {
		hostingHost: ns.getHostname(),
		targetHost,
		batchingMethod: getArgumentValue(ns.args, "--batching-method"),
		maxBatches: 0,
		actionInterval: 85,
		hasBatchingCompleted,
		doDebugging: true
	});

	//ns.tprint("BatchInformation: ", batchInformation);
	ns.tprint(`Batchlog file: ${batchInformation.batchLogFile}`);
}

export default main;
