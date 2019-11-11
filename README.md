# CliMan - argument parsing once more

I've been very irritated with CLI argument parsers as a whole. The usually are based on some existing api that poorly interfaces with javascript and have poor typescript support.

After yet another CLI app that I had to quickly write for a customer I noticed that I used most of my time fighting with the argument parsing library (it was [commander](https://www.npmjs.com/package/commander)). I got furious seeing the wasted time, set down with a pen and sketched out my own argument parser.

Is it any better? It's up to you to decide. I know that I will use from now on.

Key features:

* no dependencies
* compact and lightweight
* written in typescript for typescript (but can be used without problems with regular javascript)
* entire CLI structure defined in a single JSON
* everything documented with no hidden features that you have to search the source code to find

Features in general

* git style commands with options hierarchy
* default values
* mandatory options
* fixed position parameters (optional, repeatable)
* option / parameter parsers / validators
* auto-generated help

## Configuration

The library is controlled by a single JSON object defining the entire CLI structure. The main object used in this config is a `CliCommand` object. There are two types of `CliCommand` objects:

1. `ActionCommands` with fixed position parameter definitions and a single callback function
2. `SubCommands` with an array of `CliCommand` (Sub or Action) objects

A detailed description of the `CliCommand` object structure and it's child objects can be found in the sections below.

### CliCommand object

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | The command name |
| `help?` | `string` | Short command description displayed in auto-generated help |
| `extendedHelp?` | `string` | Longer command description displayed when help is requested for this specific command |
| `options?` | `CliOption[]` | An array with command option definitions |
| `commands` | `CliCommand[]` | _(SubCommand only)_ An array with child commands |
| `parameters?` | `CliParameter[]` | _(ActionCommand only)_ An array with fixed position parameter definitions |
| `handler` | `Function` | _(ActionCommand only_) Callback called when all command arguments are successfully parsed and matched to this command. |

### ActionCommand handler

Command handlers are called with parameter values passed as arguments. An additional argument is added at the end being the options object. The option object is a dictionary with all parsed options. To demonstrate this on an example:

```typescript
{
	name: "example"
	options: [{name: "optionName"}]
	parameters: [{name: "param1"}, {name: "param2"}]
	handler: (param1: string, param2: string, options: {optionName?: string}) => {
		/* do stuff */
	}
}
```

### CliOption object

| Field | Type | Description | Exclusive with |
| :--- | :--- | :--- | :--- |
| `name` | `string` | The option full name in camel case (`"fullName"` matches `--full-name`) | - |
| `symbol?` | `string` | The option symbol (`"f"` matches `-f`) | - |
| `help?` | `string` | Option description displayed in auto-generated help | - |
| `boolean?` | `boolean` | Make the option a boolean flag - it does not expect any value and it's default value is set to false. | repeatable, parser, default, required, valueName |
| `required?` | `boolean` | If a required option is not provided by the user an error will be reported. | default, boolean, handler |
| `repeatable?` | `boolean` | The option can be provided multiple times, the resulting value is an array. | boolean, default, handler |
| `valueName?` | `string` | The value name that will be displayed in auto-generated help | boolean |
| `default?` | `string` | Default value for the option. If a parser is defined it will be applied to this value as well. | boolean, required, repeatable |
| `parser?` | `Function` | A parser function for this option values. Takes one argument being the raw value, can return any value. Returning null indicates parsing error. Multiple data parsers are predefined under `CliMan.parsers.*`. | boolean |
| `handler?` | `Function` | Parsing will end after encountering this option. If option is boolean one argument of `CliCommand[]` type is passed to the handler with the current command stack. If option was not boolean then the first argument is the option value and the second is the command stack. Useful for implementing stuff like `--help` or `--version`. | required, default, repeatable |

When using the library with typescript the mutual field exclusions are checked during compilation time via the type system. There are no runtime checks implemented and an invalid configuration can lead to unexpected behavior.

### Command stack

Command stack is passed as the last argument to option handlers. It represents the current parser state and is useful mostly for generating help with `CliMan.help`. It simply is an array of all commands encountered in the input during parsing.

### CliParameter object

| Field | Type | Description | Exclusive with |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Parameter name, used only for the auto-generated help and error messages | - |
| `help?` | `string` | Parameter description displayed in auto-generated help | - |
| `repeatable?` | `boolean` | The parameter can be repeated any amount of times but at least one value must be provided. Use the `optional` flag to change that. The parameter is passed to the command handler as an array. Can be only set for the last parameter. | default |
| `optional?` | `boolean` | The parameter can be omitted. Optional parameters are initialized to `undefined`. After an optional parameter all following parameters have to be optional or have a default value. | default | 
| `default?` | `string` | Default value for the parameter. A parameter with a default value is automatically made optional. When a parameter with a default value is omitted the provided value (processed by the parameter parser if present) is passed to the command handler. | optional, repeatable |
| `parser?` | `Function` | A parser function for this parameter. Takes one argument being the raw value, can return any value. Returning null indicates parsing error. Multiple data parsers are predefined under `CliMan.parsers.*`. | - |

No runtime checks are implemented for verifying parameter configuration consistency. An invalid configuration can lead to unexpected behavior.

### Naming convention

All command, parameter and option names should be provided in camel case. They will be automatically converted to hyphen-separated names for matching CLI options and for the auto-generated help.

## Auto-generated help

The library generates detailed usage help based on the configuration. The help messages are generated per command.

### Help structure

```
usage: {root command name} {sub-command name} {...} {current command name} {parameter definition} {...}

{command help}

{command extended help}

#if SubCommand
Commands:
  {command name} : {parameter definition} {...}
  {...}
#else
Parameters:
  {parameter name}: {parameter help}
  {...}
#endif

Required options:
  {option definition}: {option help}
  {...}

Options:
  {option definition}: {option help}
  {...}

Inherited options ({sub-command name}):
  {option definition}: {option help}
  {...}

{...}

Global options:
  {option definition}: {option help}
  {...}
```

> Note: Required options are combined from all sub-commands in the current path and displayed together

#### Parameter definitions

The format of the auto-generated parameter definitions has been described below:

| Parameter definition | description |
| :--- | :--- |
| `[{name}={default}]` | parameters with a default value |
|`[{name}]` | optional parameter |
| `[{name}]+` | repeatable optional parameter |
| `<{name}>+` | repeatable non-optional parameter |
| `<{name}>` | "normal" parameter |

#### Option definitions

The format of the auto-generated option definitions has been described below:

| Option definition | description |
| :--- | :--- |
| `-{symbol}, --{name} <{valueName}={default}>` | option with a default value |
| `-{symbol}, --{name} <{valueName}>` | non boolean option without a default value |
| `-{symbol}, --{name}` | boolean option |
| `-{symbol}, --{name} <valueName>, +` | repeatable option |

> Note: `valueName` when not provided defaults to `VALUE`

### Invoking help

By default help is displayed

1. After a parse error
2. When parsing ends on a sub-command

A classic `-h / --help` can be easily implemented by adding a boolean option to the root command with `CliMan.help` as its handler.

```javascript
{
	name: "help",
	symbol: "h",
	help: "display help and exit",
	boolean: true,
	handler: CliMan.help
}
```

## Api

### Exported types

* CliCommand
* CliOption
* CliParameter

These types have been described in detail in the _Configuration_ section above.

### (Class) CliParseError

Extends standard `Error`. Error object thrown by the parser after encountering a parsing error. In addition to the error message an additional public member `path: CliCommand[]` is added to the error object. It contains the command stack and can be used to generate help using `CliMan.help`.

This error is thrown only from the `runNoWrapper` CliMan member function. Other run functions automatically catch this error, display the error message and generate help.

### (Class) CliMan

The main class of this library.

#### Static members

#### run(config[, args])

* `config: CliCommand` configuration JSON (described in on of the sections above)
* `args?: string[]` command argument array. If not provided `process.argv.slice(2)` is used.

A do-it-all convenience function. Creates a CliMan object and calls the `run` function.

#### help(path[, returnAsString])

* `path: CliCommand[]` the command stack to generate the help for
* `returnAsString?: boolean` when true help is returned as a string, otherwise it is displayed using `console.info`

Generate the help message based on a command stack.

#### parsers

Some most common data parser functions bundled with the library to use with parameter / options values.

* `integer` accepts decimal integer values, returns `number`
* `number` accepts any decimal values, returns `number`
* `json` accepts valid JSON strings, returns the parsed object
* `range(min: number, max: number, integer?: boolean)` accepts decimal values in the `<min, max)` range, returns `number`; `integer` can be set to allow only integer values.
* `regex(re: RegExp, group?: number)` accepts only values matching the provided RegExp object. By default returns the input string, but a chosen regex group can be return by providing the group number.
* `enum(...values: string[])` accepts only inputs matching one of the provided values, returns the input string

### Public members

#### constructor(config)

* `config: CliCommand` configuration JSON (described in on of the sections above)

#### run(args)

* `args: string[]` command argument array to use

Runs the parser. After encountering an parse error the error message is displayed and help is printed.

#### runNoWrapper(args)

* `args: string[]` command argument array to use

Runs the parser. After encountering a parse error `CliParseError` is thrown.

> When parsing ends on a sub-command CliParseError is called with an empty message

## Examples

```typescript
import { CliMan } from "climan"

CliMan.run({
	name: "httpd",
	help: "http server daemon",
	options: [
		{
			name: "help",
			symbol: "h",
			help: "display help and exit",
			boolean: true,
			handler: CliMan.help
		},
		{
			name: "port",
			symbol: "p",
			help: "port to listen on",
			default: "80",
			parser: CliMan.parsers.integer
		},
		{
			name: "interface",
			symbol: "i",
			help: "interface to listen on",
			default: "localhost"
		}
	],
	parameters: [{name: "fsRoot", help: "server filesystem root"}],
	handler: (fsRoot: string, options: {port: number, interface: string}) =>
		console.log(`serving files from ${fsRoot} on ${options.interface}:${options.port}`)
})
```

Running this example without any arguments results in:

```
$ node ./example
error: no value provided for required Parameter "fs-root"

usage: httpd <fs-root>

http server daemon

Parameters:
  fs-root : server filesystem root

Options:
  -h, --help                        : display help and exit
  -p, --port <value=80>             : port to listen on
  -i, --interface <value=localhost> : interface to listen on
  ```

See examples folder for more examples.