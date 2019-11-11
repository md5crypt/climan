type MakeDisjoint <T1, T2> = T1 & {[T in Exclude<keyof T2, keyof T1>]?: undefined}

interface OptionBase {
	name: string
	symbol?: string
	help?: string
}

interface OptionBoolean extends OptionBase {
	boolean: boolean
	handler?: (path: CliCommand[]) => any
}

interface OptionValue extends OptionBase {
	valueName?: string
	parser?: (value: string) => any
}

interface OptionHandler extends OptionValue {
	handler: (value: any, path: CliCommand[]) => any
}

interface OptionDefault extends OptionValue {
	default: string
}

interface OptionOther extends OptionValue {
	repeatable?: boolean
	required?: boolean
}

type OptionIntersection = OptionBoolean & OptionHandler & OptionDefault & OptionOther

export type CliOption = (
	MakeDisjoint<OptionBoolean, OptionIntersection> |
	MakeDisjoint<OptionHandler, OptionIntersection> |
	MakeDisjoint<OptionDefault, OptionIntersection> |
	MakeDisjoint<OptionOther, OptionIntersection>
)

interface ParameterBase {
	name: string
	help?: string
	parser?: (value: string) => any
}

interface ParameterDefault extends ParameterBase {
	default: string
}

interface ParameterOther extends ParameterBase {
	repeatable?: boolean
	optional?: boolean
}

type ParameterIntersection = ParameterDefault & ParameterOther

export type CliParameter = (
	MakeDisjoint<ParameterDefault, ParameterIntersection> |
	MakeDisjoint<ParameterOther, ParameterIntersection>
)

interface CommandBase {
	name: string
	help?: string
	extendedHelp?: string
	options?: CliOption[]
}

interface SubCommand extends CommandBase {
	commands: CliCommand[]
}

interface ActionCommand extends CommandBase {
	parameters?: CliParameter[]
	handler: Function
}

type CommandIntersection = SubCommand & ActionCommand

export type CliCommand = (
	MakeDisjoint<SubCommand, CommandIntersection> |
	MakeDisjoint<ActionCommand, CommandIntersection>
)

export class CliParseError extends Error {
	public readonly path: CliCommand[]
	constructor (path: CliCommand[], message?: string) {
		super(message)
		this.path = path
	}
}

function toCamel(str: string) {
	return str.replace(/-./g, m => m[1].toUpperCase())
}

function fromCamel(str: string) {
	return str.replace(/[A-Z]/g, m => "-" + m.toLowerCase())
}

function helpOption(option: CliOption) {
	const base = `${option.symbol ? `-${option.symbol}, `: ""}--${fromCamel(option.name)}`
	if (option.boolean) {
		return base
	}
	const value = `<${option.valueName || "value"}${option.default ? `=${option.default}` : ""}>${option.repeatable ? ", +" : ""}`
	return base + " " + value
}

function helpParameter(parameter: CliParameter) {
	const value = fromCamel(parameter.name) + (parameter.default ? `=${parameter.default}` : "")
	return ((parameter.optional || parameter.default) ? `[${value}]` : `<${value}>`) + (parameter.repeatable ? "+" : "")
}

function helpOptions(path: CliCommand[]) {
	let padding = 0

	const groups: {
		name: string
		pairs: [string, string][]
	}[] = [{name: "Required options", pairs: []}]

	for (let i = path.length - 1; i >= 0; i -= 1) {
		const command = path[i]
		if (!command.options) {
			continue
		}
		const pairs: [string, string][] = []
		for (const option of command.options) {
			const base = helpOption(option)
			padding = Math.max(base.length, padding)
			const target = (option.required ? groups[0].pairs : pairs)
			target.push([base, option.help || ""])
		}
		if (pairs.length) {
			let name: string
			if (i == path.length - 1) {
				name = "Options"
			} else if (i == 0) {
				name = "Global options"
			} else {
				name = `Inherited options (${fromCamel(command.name)})`
			}
			groups.push({name, pairs})
		}
	}

	if (groups[0].pairs.length == 0) {
		groups.shift()
	}

	padding = Math.min(padding, 80)
	let output = ""
	for (const group of groups) {
		output += `\n\n${group.name}:\n`
		output += group.pairs.map(([base, info]) => "  " + base.padEnd(padding, " ") + " : " + info).join("\n")
	}
	return output
}

function helpCommand(command: CliCommand) {
	if ((command as ActionCommand).handler) {
		if ((command as ActionCommand).parameters) {
			return fromCamel(command.name) + " " + (command as ActionCommand).parameters!.map(helpParameter).join(" ")
		}
		return fromCamel(command.name)
	} else {
		return fromCamel(command.name) + " (...)"
	}
}

function help(path: CliCommand[]) {
	const command = path[path.length - 1]
	let output = "usage: " + ((path.length > 1) ? (path.slice(0, -1).map(command => fromCamel(command.name)).join(" ") + " ") : "") + helpCommand(command)
	if (command.help) {
		output += "\n\n" + command.help
	}
	if (command.extendedHelp) {
		output += "\n\n" + command.extendedHelp
	}
	if ((command as ActionCommand).parameters) {
		const padding = (command as ActionCommand).parameters!.reduce((a, b) => Math.max(a, fromCamel(b.name).length), 0)
		output += "\n\nParameters:\n" + (command as ActionCommand).parameters!
			.map(Parameter => "  " + fromCamel(Parameter.name).padEnd(padding, " ") + " : " + (Parameter.help || ""))
			.join("\n")
	}
	if ((command as SubCommand).commands) {
		const commands = (command as SubCommand).commands.map(command => [helpCommand(command), command.help || ""])
		const padding = commands.reduce((a, b) => Math.max(a, b[0].length), 0)
		output += "\n\nCommands:\n" + commands
			.map(x => "  " + x[0].padEnd(padding, " ") + " : " + x[1])
			.join("\n")
	}
	output += helpOptions(path)
	return output
}

function parserRun(args: string[], command: SubCommand | ActionCommand, path: CliCommand[], options: {[key: string]: any}): void {
	// push the current command to the command stack
	path.push(command)

	// initialize command options with their default values
	if (command.options) {
		for (const option of command.options) {
			if (option.default) {
				// if a data parser is defined run the default value thought it
				options[option.name] = option.parser ? option.parser(option.default) : option.default
			} else if (option.repeatable) {
				// a repeatable option needs to be initialized with a empty array if no default value was given
				options[option.name] = []
			} else if (option.boolean && !option.handler) {
				// boolean options are initialized with false
				options[option.name] = false
			}
		}
	}

	// initialize parameters with their default values
	const parameters: any[] = []
	if ((command as ActionCommand).handler) {
		const cmd = (command as ActionCommand)
		// check if the command has any parameters at all
		if (cmd.parameters) {
			for (const parameter of cmd.parameters) {
				let value
				// if default value exists, set it
				if (parameter.default) {
					value = parameter.parser ? parameter.parser(parameter.default) : parameter.default
				} else if (parameter.repeatable) {
					// if no default value is given but Parameter is repeatable, initialize with empty array
					value = []
				} else if (parameter.optional) {
					// if no default value is given but Parameter optional, set to undefined
					value = undefined
				} else {
					// in other cases initialize to null
					value = null
				}
				parameters.push(value)
			}
		}
	}

	// for ActionCommands this will hold the current Parameter number
	let currentParameterIndex = 0

	// loop though command arguments
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i]

		// check if the command argument is a option
		if (arg[0] == "-") {

			// find a matching option definition, we scan all the commands currently on the stack
			let option: CliOption | undefined = undefined
			if (arg[1] == "-") {
				// for long-options find a option with a matching name
				const name = toCamel(arg.slice(2))
				for (let i = path.length - 1; (i >= 0) && (option === undefined); i -= 1) {
					option = (path[i].options && path[i].options!.find(opt => opt.name == name))
				}
			} else if (arg.length == 2) {
				// for short-options find a option with a matching symbol
				for (let i = path.length - 1; (i >= 0) && (option === undefined); i -= 1) {
					option = path[i].options && path[i].options!.find(opt => opt.symbol == arg[1])
				}
			} else {
				// a long-option with a single "-" was given
				throw new CliParseError(path, `invalid argument "${arg}"`)
			}

			// check if we found a matching option definition
			if (!option) {
				throw new CliParseError(path, `unknown option "${arg}"`)
			}

			// if the option is a boolean option simply set it to true
			if (option.boolean) {
				// if the option has a handler defined, terminate what we are doing and call the handler
				if (option.handler) {
					return option.handler(path)
				}
				// set option value to true
				options[option.name] = true
			} else {
				// it is not a boolean option, we expect a value
				i += 1

				// check if there is a next value
				if (i >= args.length) {
					throw new CliParseError(path, `option "${arg}" requires a value`)
				}

				// run the option thorough the option parser (if one is defined)
				const value = option.parser ? option.parser(args[i]) : args[i]
				if (value === null) {
					throw new CliParseError(path, `invalid value "${args[i]}" for option "${arg}"`)
				}

				// if the option has a handler defined, terminate what we are doing and call the handler
				if (option.handler) {
					return option.handler(value, path)
				}

				// repeatable options need to be appended to an array
				if (option.repeatable) {
					options[option.name].push(value)
				} else {
					options[option.name] = value
				}
			}

		} else if ((command as SubCommand).commands) {
			// the argument is not an option (does not start with "-") and current command is a sub-command
			// assume the argument is a command name and try to find a matching command definition
			const next = (command as SubCommand).commands.find(x => x.name == toCamel(arg))

			// check if a matching command was found
			if (!next) {
				throw new CliParseError(path, `unrecognized command "${arg}"`)
			}

			// recursively start parsing the matched command
			return parserRun(args.slice(i + 1), next, path, options)
		} else {
			// the argument is not an option (does not start with "-") and current command is a action-command
			// assume it is a Parameter value
			const cmd = (command as ActionCommand)

			// check if the command is expecting a Parameter and fetch the Parameter definition
			if (!cmd.parameters || (currentParameterIndex >= cmd.parameters.length)) {
				throw new CliParseError(path, `unexpected Parameter "${arg}"`)
			}
			const Parameter = cmd.parameters[currentParameterIndex]

			// run the Parameter value thorough the Parameter parser (if one is defined)
			const value = Parameter.parser ? Parameter.parser(args[i]) : args[i]
			if (value === null) {
				throw new CliParseError(path, `invalid value "${args[i]}" for Parameter "${fromCamel(Parameter.name)}"`)
			}

			// repeatable parameters need to be appended to an array
			// also a repeatable parameter does not increase the param counter
			// the parser will be "stuck" on the repeatable Parameter till the end
			if (Parameter.repeatable) {
				parameters[currentParameterIndex].push(value)
			} else {
				parameters[currentParameterIndex] = value
				currentParameterIndex += 1
			}
		}
	}

	// we finished parsing all command line arguments, check what type of command we ended up in
	if ((command as ActionCommand).handler) {
		// action command
		const cmd = (command as ActionCommand)

		// go though parameters, throw error if a required Parameter is missing
		// missing required parameters will be null
		if (cmd.parameters && (cmd.parameters.length > 0)) {
			const indexOfNull = parameters.indexOf(null)
			const last = cmd.parameters.length - 1
			const paramMissing = (indexOfNull >= 0) || (
				cmd.parameters[last].repeatable &&
				!cmd.parameters[last].optional &&
				(parameters[last].length == 0)
			)
			if (paramMissing) {
				const name = fromCamel(cmd.parameters[(indexOfNull >= 0) ? indexOfNull : last].name)
				throw new CliParseError(path, `no value provided for required Parameter "${name}"`)
			}
		}

		// go though options, throw error if a required option is missing
		// we need to go though options of all commands on the path stack
		for (const command of path) {
			if (command.options) {
				for (const option of command.options) {
					if (option.required && (!(option.name in options) || (option.repeatable && (options[option.name].length == 0)))) {
						throw new CliParseError(path, `missing required option "--${fromCamel(option.name)}"`)
					}
				}
			}
		}

		// call the handler
		return cmd.handler(...parameters, options, path)
	} else {
		// we ended execution in a sub-command, return help
		throw new CliParseError(path)
	}
}

export class CliMan {
	private config: CliCommand

	constructor(config: CliCommand) {
		this.config = config
	}

	public run(args: string[]) {
		try {
			parserRun(args, this.config, [], {})
		} catch (e) {
			if (e instanceof CliParseError) {
				if (e.message) {
					console.error("error: " + e.message + "\n")
				}
				console.info(help(e.path))
			} else {
				throw e
			}
		}
	}

	public runNoWrapper(args: string[]) {
		parserRun(args, this.config, [], {})
	}

	public static run(config: CliCommand, args?: string[]) {
		new CliMan(config).run(args || process.argv.slice(2))
	}

	public static help(path: CliCommand[]): void
	public static help(path: CliCommand[], returnAsString?: boolean) {
		const output = help(path)
		if (returnAsString) {
			return output
		}
		console.info(output)
		return
	}

	public static parsers = {
		integer: (value: string) => value.match(/^[+-]?\d+$/) ? parseInt(value, 10) : null,
		number: (value: string) => value.match(/^[+-]?[.]\d+|[+-]?\d+([.]\d+)?$/) ? parseFloat(value) : null,
		range: (min: number, max?: number, integer = false) => (value: string) => {
			const number = integer ? CliMan.parsers.integer(value) : CliMan.parsers.number(value)
			return (number !== null) && (number >= min) && ((max == undefined) || (number < max)) ? number : null
		},
		regex: (re: RegExp, group?: number) => (value: string) => {
			const match = value.match(re)
			return match ? (group === undefined ? value : match[group]) : null
		},
		enum: (...values: string[]) => (value: string) => values.includes(value) ? value : null,
		json: (value: string) => {
			try {
				return JSON.parse(value)
			} catch (_e) {
				return null
			}
		}
	}

}
