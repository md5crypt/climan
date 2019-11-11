import { CliMan } from "climan"

function printArgs() {
	console.log(...Array.from(arguments).slice(0, -1))
}

CliMan.run({
	name: "forest",
	help: "national forest manager cli",
	options: [
		{
			name: "help",
			symbol: "h",
			help: "display help and exit",
			boolean: true,
			handler: CliMan.help
		},
		{
			name: "version",
			help: "display application version and exit",
			handler: () => console.log("forest v1.42 build 4242"),
			boolean: true
		},
		{
			name: "verbose",
			symbol: "v",
			help: "enable verbose output",
			boolean: true
		}
	],
	commands: [
		{
			name: "add",
			help: "add objects to the forest",
			options: [
				{
					name: "dryRun",
					help: "to a test run without changing any actual state",
					boolean: true
				},
				{
					name: "sectorId",
					symbol: "s",
					help: "destination forest sector to add object",
					parser: CliMan.parsers.integer,
					required: true
				}
			],
			commands: [
				{
					name: "tree",
					help: "add a tree(s) to a forest sector",
					options: [
						{
							name: "type",
							symbol: "t",
							valueName: "TYPE",
							default: "pine",
							parser: CliMan.parsers.enum("pine", "oak", "maple", "willow"),
							help: "type of tree to add",
						},
						{
							name: "count",
							valueName: "N",
							symbol: "c",
							default: "1",
							parser: CliMan.parsers.range(1, 10, true),
							help: "amount of trees to add (max 10)"
						},
						{
							name: "useFertilizer",
							symbol: "f",
							valueName: "NAME",
							repeatable: true,
							help: "use a fertilizer during planting, can be repeated to use multiple fertilizers"
						}
					],
					handler: printArgs
				},
				{
					name: "animal",
					help: "add an animal(s) to a forest sector",
					parameters: [
						{
							name: "species",
							repeatable: true,
							optional: true,
							help: "specie of the specimen to add, multiple values can be passed"
						}
					],
					handler: printArgs
				}
			]
		},
		{
			name: "move",
			help: "move objects between forest sectors",
			extendedHelp: "Warning! Operator must make sure the dentation forest sector has correct habitat for the moved object!",
			options: [
				{
					name: "all",
					symbol: "a",
					help: "when source ambiguous move all matching objects instead of failing",
					boolean: true
				}
			],
			parameters: [
				{
					name: "object",
					help: "name of object to be moved"
				},
				{
					name: "destination",
					help: "destination sector id",
					default: "1",
					parser: CliMan.parsers.integer
				},
				{
					name: "source",
					help: "source sector id, can be omitted when object is present only in one sector or if --all flag is used",
					optional: true,
					parser: CliMan.parsers.integer
				}
			],
			handler: printArgs
		}
	]
})
