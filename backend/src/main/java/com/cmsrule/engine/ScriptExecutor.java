package com.cmsrule.engine;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Python脚本执行器
 * 使用子进程执行用户编写的Python脚本
 * 支持超时自动终止、stdout/stderr捕获
 */
@Component
@Slf4j
public class ScriptExecutor {

    private static final String PYTHON_BIN = "python3";

    /**
     * 执行Python脚本
     * @param script Python脚本代码
     * @param timeoutSeconds 超时秒数（默认5秒）
     * @return 执行结果
     */
    public Result execute(String script, int timeoutSeconds) {
        if (script == null || script.isBlank()) {
            return new Result(false, "", "Script is empty", -1);
        }

        String trimmed = script.trim();
        String command;
        if (trimmed.startsWith("#!") || !trimmed.contains("\n")) {
            // 单行脚本：使用 -c 执行
            command = PYTHON_BIN + " -c " + escapeShellArg(trimmed);
        } else {
            // 多行脚本：写入临时文件执行
            command = PYTHON_BIN + " -c " + escapeShellArg(trimmed);
        }

        return runProcess(command, timeoutSeconds);
    }

    /**
     * 执行Python脚本文件
     * @param scriptFilePath Python文件路径
     * @param args 命令行参数
     * @param timeoutSeconds 超时秒数
     * @return 执行结果
     */
    public Result executeFile(String scriptFilePath, String[] args, int timeoutSeconds) {
        StringBuilder cmd = new StringBuilder(PYTHON_BIN + " ");
        cmd.append(escapeShellArg(scriptFilePath));
        if (args != null) {
            for (String arg : args) {
                cmd.append(" ").append(escapeShellArg(arg));
            }
        }
        return runProcess(cmd.toString(), timeoutSeconds);
    }

    /**
     * 执行Python模块/命令
     * @param moduleCommand 如 "python -m json.tool"
     * @param stdinInput 标准输入内容（可为null）
     * @param timeoutSeconds 超时秒数
     * @return 执行结果
     */
    public Result executeCommand(String moduleCommand, String stdinInput, int timeoutSeconds) {
        return runProcessWithInput(moduleCommand, stdinInput, timeoutSeconds);
    }

    // ==================== 内部方法 ====================

    private Result runProcess(String command, int timeoutSeconds) {
        return runProcessWithInput(command, null, timeoutSeconds);
    }

    private Result runProcessWithInput(String command, String stdinInput, int timeoutSeconds) {
        ProcessBuilder pb = new ProcessBuilder("sh", "-c", command);
        pb.redirectErrorStream(false);

        StringBuilder stdout = new StringBuilder();
        StringBuilder stderr = new StringBuilder();

        try {
            Process process = pb.start();

            // 如果有stdin输入，写入进程
            if (stdinInput != null && !stdinInput.isBlank()) {
                try (var writer = new java.io.PrintWriter(process.getOutputStream())) {
                    writer.println(stdinInput);
                    writer.flush();
                }
            }

            // 并发读取stdout和stderr
            Thread stdoutReader = startReader(process.getInputStream(), stdout);
            Thread stderrReader = startReader(process.getErrorStream(), stderr);

            // 等待进程完成或超时
            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                stdoutReader.interrupt();
                stderrReader.interrupt();
                log.warn("脚本执行超时（{}秒），已强制终止: {}", timeoutSeconds, command);
                return new Result(false, stdout.toString(), "Execution timeout after " + timeoutSeconds + " seconds", -1);
            }

            // 确保读取线程结束
            try {
                stdoutReader.join(500);
                stderrReader.join(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            int exitCode = process.exitValue();
            boolean success = exitCode == 0;

            if (!success) {
                log.warn("脚本执行失败: exitCode={}, stderr={}", exitCode, stderr);
            }

            return new Result(success, stdout.toString().trim(), stderr.toString().trim(), exitCode);

        } catch (Exception e) {
            log.error("脚本执行异常: command={}, error={}", command, e.getMessage(), e);
            return new Result(false, stdout.toString().trim(), e.getMessage(), -1);
        }
    }

    private Thread startReader(InputStream is, StringBuilder buffer) {
        Thread t = new Thread(() -> {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(is))) {
                String line;
                while ((line = br.readLine()) != null) {
                    if (buffer.length() > 0) {
                        buffer.append("\n");
                    }
                    buffer.append(line);
                }
            } catch (Exception e) {
                // 忽略读取异常
            }
        });
        t.start();
        return t;
    }

    /**
     * 转义Shell参数（防止注入）
     */
    private String escapeShellArg(String arg) {
        if (arg == null) return "''";
        // 使用单引号包裹，单引号内部转义单引号
        String escaped = arg.replace("'", "'\\''");
        return "'" + escaped + "'";
    }

    // ==================== 执行结果 ====================

    public static class Result {
        private final boolean success;
        private final String stdout;
        private final String stderr;
        private final int exitCode;

        public Result(boolean success, String stdout, String stderr, int exitCode) {
            this.success = success;
            this.stdout = stdout != null ? stdout : "";
            this.stderr = stderr != null ? stderr : "";
            this.exitCode = exitCode;
        }

        public boolean isSuccess() { return success; }
        public String getStdout() { return stdout; }
        public String getStderr() { return stderr; }
        public int getExitCode() { return exitCode; }

        public String getOutput() { return stdout; }

        @Override
        public String toString() {
            return String.format("Result{success=%s, exitCode=%d, stdout='%s', stderr='%s'}",
                    success, exitCode, stdout, stderr);
        }
    }
}
