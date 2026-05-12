"""
Standalone MCP math server for testing Agentic Forge's MCP client.
Run with:  python math_mcp_server.py
Listens on http://localhost:8090/mcp
"""

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("math-server", host="127.0.0.1", port=8090)


@mcp.tool()
def add(a: float, b: float) -> float:
    """Add two numbers."""
    return a + b


@mcp.tool()
def subtract(a: float, b: float) -> float:
    """Subtract b from a."""
    return a - b


@mcp.tool()
def multiply(a: float, b: float) -> float:
    """Multiply two numbers."""
    return a * b


@mcp.tool()
def divide(a: float, b: float) -> float:
    """Divide a by b."""
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b


if __name__ == "__main__":
    print("Math MCP server starting on http://localhost:8090/mcp")
    mcp.run(transport="streamable-http")
