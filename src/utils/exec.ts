import { execa } from "execa";

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

export async function runCommand(
  command: string,
  args: string[],
  cwd?: string,
  env?: Record<string, string>,
  input?: string
): Promise<CommandResult> {
  try {
    const result = await execa(command, args, {
      cwd,
      shell: false,
      env,
      // When input is provided, the prompt is piped via stdin instead of a CLI arg.
      // This avoids cmd.exe splitting multi-line prompts at newlines on Windows.
      ...(input !== undefined ? { input } : {})
    });

    return {
      success: true,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    const failed = error as {
      stdout?: string;
      stderr?: string;
      shortMessage?: string;
      message?: string;
    };

    return {
      success: false,
      stdout: failed.stdout ?? "",
      stderr:
        failed.stderr ??
        failed.shortMessage ??
        failed.message ??
        "Unknown command error"
    };
  }
}
