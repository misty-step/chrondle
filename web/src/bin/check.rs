//! One native check entry, callable by local development and the release owner.
use std::process::{Command, ExitCode};

fn main() -> ExitCode {
    let args: Vec<_> = std::env::args().skip(1).collect();
    let full = match args.as_slice() {
        [] => false,
        [flag, mode] if flag == "--mode" && mode == "fast" => false,
        [flag, mode] if flag == "--mode" && mode == "full" => true,
        _ => {
            eprintln!("usage: bun run check [--mode fast|full]");
            return ExitCode::from(64);
        }
    };
    let mut commands: Vec<Vec<&str>> = vec![
        vec![
            "cargo",
            "fmt",
            "--manifest-path",
            "web/Cargo.toml",
            "--",
            "--check",
        ],
        vec![
            "cargo",
            "test",
            "--locked",
            "--manifest-path",
            "web/Cargo.toml",
        ],
        vec!["bun", "run", "lint"],
        vec!["bun", "run", "type-check"],
        vec!["bun", "run", if full { "test:coverage" } else { "test" }],
    ];
    if full {
        commands.extend([
            vec!["bun", "run", "backend:test"],
            vec!["bun", "scripts/verify-ci-backend.mjs"],
            vec!["bun", "run", "build:cf"],
            vec!["bun", "run", "test:worker-routes"],
            vec!["bun", "run", "test:discovery"],
        ]);
    }
    for command in commands {
        println!("check: {}", command.join(" "));
        match Command::new(command[0]).args(&command[1..]).status() {
            Ok(status) if status.success() => {}
            result => {
                eprintln!("check failed: {result:?}");
                return ExitCode::FAILURE;
            }
        }
    }
    ExitCode::SUCCESS
}
